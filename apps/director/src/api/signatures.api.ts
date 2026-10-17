import { request, sessionContext } from '@/api/client';
import { downloadBlob } from '@/utils/format';
import { resolveYearId } from '@/api/context';
import { createStudentsApi } from '@/api/students.api';
import { AppError } from '@/services/errors';
import type {
  AcademicYearConfigResponseDto,
  SignatureRecordResponseDto,
  SignedDocumentResponseDto,
  SignRequestDto,
  UserResponseDto,
} from '@/types/api';
import type { SignaturesPort } from '@/services/ports';
import type { BulletinPeriod, SignedDocument } from '@/types/domain';

/**
 * Portage réel (suite task #230, étendu task #256) — `signDocument`/
 * `listDocuments`/`listBulletinPeriods`/`signBulk` pour le BULLETIN
 * (`academic-service` génère son PDF) et les 5 autres types génériques
 * (certificat de scolarité, attestation de travail, certificat de
 * présence, attestation de réussite, document administratif), dont le PDF
 * non signé est désormais produit par le générateur générique de
 * `document-service` (`GET /api/v1/documents/administrative/{type}/{userId}/pdf`)
 * puis signé exactement comme le bulletin via `POST /api/v1/signatures`
 * (`signature-service`, déjà générique, appose cachet/signature).
 * `importToSign` reste sur le mock (aucun équivalent backend : enregistrer
 * un document déjà signé sur papier/scanné n'a pas d'endpoint).
 */

const DOC_TYPE_LABEL: Record<string, string> = {
  BULLETIN: 'Bulletin',
  CERTIFICATE: 'Certificat',
  ATTESTATION: 'Attestation',
  OFFICIAL: 'Document administratif',
  RELEVE_NOTES: 'Relevé de notes',
  OTHER: 'Document',
};

function periodNumber(periodKey: string): number {
  const n = Number(periodKey.replace(/^t/, ''));
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError('validation', `Période de bulletin invalide : ${periodKey}`, 400);
  }
  return n;
}

/** Conversion Blob → base64, par blocs pour ne pas dépasser la pile d'appel sur un gros PDF. */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function fetchBulletinPdfBase64(studentId: string, semesterNumber: number): Promise<string> {
  const { schoolId } = sessionContext();
  const yearId = await resolveYearId();
  const blob = await request<Blob>(
    `/api/v1/academic/bulletins/student/${encodeURIComponent(studentId)}/semester/${semesterNumber}/pdf`,
    { query: { schoolId, yearId }, responseType: 'blob' },
  );
  return blobToBase64(blob);
}

async function signBulletin(
  studentId: string,
  semesterNumber: number,
  action: 'SIGNATURE' | 'CACHET' = 'SIGNATURE',
): Promise<SignedDocumentResponseDto> {
  const yearId = await resolveYearId();
  const documentBytes = await fetchBulletinPdfBase64(studentId, semesterNumber);
  const body: SignRequestDto = {
    documentType: 'BULLETIN',
    documentRef: studentId,
    documentBytes,
    academicYearId: yearId,
    semesterNumber,
    action,
  };
  return request<SignedDocumentResponseDto>('/api/v1/signatures', { method: 'POST', body });
}

/**
 * Les 5 types génériques exposés par l'écran (voir `STUDENT_DOC_TYPES`/
 * `STAFF_DOC_TYPES` dans `SignaturesPage.tsx`) — chacun mappé vers le type
 * `AdministrativeDocumentType` de document-service (segment d'URL du
 * générateur PDF) et vers le `DocumentType` générique de signature-service
 * (étiquette portée par l'enregistrement de signature, pas de type dédié
 * pour chacun de ces 5 — CERTIFICATE/ATTESTATION/OFFICIAL sont réutilisés).
 */
const GENERIC_DOC_TYPE: Record<string, { path: string; signatureType: SignRequestDto['documentType'] }> = {
  'Certificat de scolarité': { path: 'CERTIFICAT_SCOLARITE', signatureType: 'CERTIFICATE' },
  'Certificat de présence': { path: 'CERTIFICAT_PRESENCE', signatureType: 'CERTIFICATE' },
  'Attestation de travail': { path: 'ATTESTATION_TRAVAIL', signatureType: 'ATTESTATION' },
  'Attestation de réussite': { path: 'ATTESTATION_REUSSITE', signatureType: 'ATTESTATION' },
  'Document administratif': { path: 'DOCUMENT_ADMINISTRATIF', signatureType: 'OFFICIAL' },
};

async function fetchAdministrativeDocumentPdfBase64(path: string, targetUserId: string): Promise<string> {
  const blob = await request<Blob>(
    `/api/v1/documents/administrative/${path}/${encodeURIComponent(targetUserId)}/pdf`,
    { responseType: 'blob' },
  );
  return blobToBase64(blob);
}

async function signGenericDocument(
  targetUserId: string,
  type: string,
  action: 'SIGNATURE' | 'CACHET' = 'SIGNATURE',
): Promise<SignedDocumentResponseDto> {
  const config = GENERIC_DOC_TYPE[type];
  if (!config) notImplemented(type);
  const documentBytes = await fetchAdministrativeDocumentPdfBase64(config.path, targetUserId);
  const body: SignRequestDto = {
    documentType: config.signatureType,
    documentRef: targetUserId,
    documentBytes,
    action,
  };
  return request<SignedDocumentResponseDto>('/api/v1/signatures', { method: 'POST', body });
}

function notImplemented(type: string): never {
  throw new AppError(
    'validation',
    `La signature de « ${type} » n'est pas encore disponible côté serveur.`,
    422,
  );
}

async function resolveTargetLabel(
  documentRef: string,
  studentNameById: Map<string, string>,
  staffNameById: Map<string, string>,
): Promise<{ cible: string; cibleKind: 'eleve' | 'personnel' }> {
  const studentName = studentNameById.get(documentRef);
  if (studentName) return { cible: studentName, cibleKind: 'eleve' };
  const staffName = staffNameById.get(documentRef);
  if (staffName) return { cible: staffName, cibleKind: 'personnel' };
  return { cible: documentRef, cibleKind: 'eleve' };
}

export function createSignaturesApi(): Pick<
  SignaturesPort,
  'listDocuments' | 'listBulletinPeriods' | 'signForStudent' | 'signForStaff' | 'signBulk' | 'downloadDocument'
> {
  return {
    async listDocuments(): Promise<SignedDocument[]> {
      const [records, students, teachers] = await Promise.all([
        request<SignatureRecordResponseDto[]>('/api/v1/signatures/school/me'),
        request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(sessionContext().schoolId)}?role=STUDENT`),
        request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(sessionContext().schoolId)}?role=TEACHER`),
      ]);
      const studentNameById = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
      const staffNameById = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));

      const resolved = await Promise.all(
        records.map(async (r) => {
          const { cible, cibleKind } = await resolveTargetLabel(r.documentRef, studentNameById, staffNameById);
          return {
            serie: r.serialNumber ?? r.signatureHash.slice(0, 12),
            type: DOC_TYPE_LABEL[r.documentType] ?? r.documentType,
            cible,
            cibleKind,
            date: new Date(r.signedAt).toLocaleDateString('fr-FR'),
            signataire: r.signerName,
            downloadUrl: r.downloadUrl ?? null,
            documentRef: r.documentRef ?? null,
            semesterNumber: r.semesterNumber ?? null,
            action: r.action ?? null,
            signatureHash: r.signatureHash,
          } satisfies SignedDocument;
        }),
      );
      return resolved;
    },

    async listBulletinPeriods(): Promise<BulletinPeriod[]> {
      const dto = await request<AcademicYearConfigResponseDto>('/api/v1/academic/config/effective', {
        query: { schoolId: sessionContext().schoolId, yearId: await resolveYearId() },
      }).catch((err) => {
        // Même état normal (début d'année, aucune configuration encore
        // posée) que `AcademicResultsPort.getEffectiveConfig` — voir
        // `academic.api.ts`.
        if (err instanceof AppError && err.kind === 'validation') return null;
        throw err;
      });
      if (!dto) return [];
      return dto.periods.map((p) => ({ key: `t${p.number}`, label: p.label, available: true }));
    },

    async signForStudent(studentId, type, period, action = 'SIGNATURE'): Promise<SignedDocument> {
      const isBulletin = type === 'Bulletin';
      if (isBulletin && !period) notImplemented(type);
      const dto = isBulletin
        ? await signBulletin(studentId, periodNumber(period as string), action)
        : await signGenericDocument(studentId, type, action);
      const [student] = await request<UserResponseDto[]>(
        `/api/v1/users/school/${encodeURIComponent(sessionContext().schoolId)}?role=STUDENT`,
      ).then((all) => all.filter((u) => u.id === studentId));
      return {
        serie: dto.serialNumber,
        type: isBulletin ? 'Bulletin' : type,
        cible: student ? `${student.firstName} ${student.lastName}` : studentId,
        cibleKind: 'eleve',
        date: new Date(dto.signedAt).toLocaleDateString('fr-FR'),
        signataire: dto.signerName,
        downloadUrl: dto.downloadUrl ?? null,
        signatureHash: dto.signatureHash,
        action,
      };
    },

    async signForStaff(staffId, type, action = 'SIGNATURE'): Promise<SignedDocument> {
      const dto = await signGenericDocument(staffId, type, action);
      const [staff] = await request<UserResponseDto[]>(
        `/api/v1/users/school/${encodeURIComponent(sessionContext().schoolId)}?role=TEACHER`,
      ).then((all) => all.filter((u) => u.id === staffId));
      return {
        serie: dto.serialNumber,
        type,
        cible: staff ? `${staff.firstName} ${staff.lastName}` : staffId,
        cibleKind: 'personnel',
        date: new Date(dto.signedAt).toLocaleDateString('fr-FR'),
        signataire: dto.signerName,
        downloadUrl: dto.downloadUrl ?? null,
        signatureHash: dto.signatureHash,
        action,
      };
    },

    async downloadDocument(signatureHash: string, filename: string): Promise<void> {
      // CORRECTION (bug signalé) : fetch + téléchargement local plutôt
      // qu'un lien direct vers une URL potentiellement indisponible/mal
      // résolue par le navigateur -- même principe que
      // `academicResults.downloadBulletinPdf`. Le nom de fichier est fourni
      // par l'appelant (déjà en possession du nom lisible de la personne
      // concernée, voir `SignedDocument.cible`), plutôt que résolu ici.
      const blob = await request<Blob>(
        `/api/v1/signatures/${encodeURIComponent(signatureHash)}/download`,
        { responseType: 'blob' },
      );
      downloadBlob(blob, filename);
    },

    async signBulk(classId, period, action = 'SIGNATURE'): Promise<{ signed: number }> {
      const semester = periodNumber(period);
      // Pas d'endpoint `/class/{classId}/students` renvoyant des profils
      // complets côté user-service (seulement des ids) -- on réutilise
      // `StudentsPort.list`, déjà réel, qui résout l'appartenance de classe.
      const roster = await createStudentsApi().list(classId);
      let signed = 0;
      for (const student of roster) {
        try {
          await signBulletin(student.id, semester, action);
          signed += 1;
        } catch {
          // Un élève sans résultat calculé/publié pour ce semestre ne doit
          // pas interrompre la signature du reste de la classe — il restera
          // simplement absent de « Documents signés » et pourra être signé
          // individuellement une fois ses résultats prêts.
        }
      }
      return { signed };
    },
  };
}
