import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import type {
  AddToSchoolRequestDto,
  ApiDocumentType,
  ApiSalaryMode,
  ClassInfoDto,
  CreateUserRequestDto,
  PayslipResponseDto,
  SchoolSalaryProfileResponseDto,
  SignatureRecordResponseDto,
  UpdateSalaryRequestDto,
  UpdateSubjectsRequestDto,
  UpdateUserRequestDto,
  UserLookupResponseDto,
  UserResponseDto,
  TimetableSlotResponseDto,
  ExamCalendarResponseDto,
  ApiExamType,
} from '@/types/api';
import type { TeachersPort } from '@/services/ports';
import type { SalaryMode, SalarySlip, SignedDocument, Teacher, TeacherLookupResult, StaffStatus, TeacherScheduleSlot, ClassEvent, EventType } from '@/types/domain';
import { buildDownloadFilename, downloadBlob, frToISO, isoToFR } from '@/utils/format';

/**
 * `classes` (noms, pas des ids) est résolu en croisant `ClassInfoDto.teacherIds`
 * (professeur principal + itinérants mêlés, voir `classes.api.ts`) de toutes
 * les classes de l'école — aucun champ direct côté `UserResponse`.
 */
/** Traduit `AccountStatus` (user-service) — voir le commentaire de `StaffStatus`. */
function toAccountStatus(statut: StaffStatus): NonNullable<UpdateUserRequestDto['status']> {
  switch (statut) {
    case 'suspendu':
      return 'SUSPENDED';
    case 'transfere':
      return 'TRANSFERRED';
    case 'en_attente':
      return 'PENDING_ACTIVATION';
    default:
      return 'ACTIVE';
  }
}

function fromAccountStatus(status: string | undefined): StaffStatus {
  switch (status) {
    case 'SUSPENDED':
      return 'suspendu';
    case 'TRANSFERRED':
      return 'transfere';
    case 'PENDING_ACTIVATION':
      return 'en_attente';
    default:
      return 'actif';
  }
}

function toSalaryModeDto(mode: SalaryMode): ApiSalaryMode {
  switch (mode) {
    case 'par_jour':
      return 'PER_WORKED_DAY';
    case 'par_heure':
      return 'PER_HOUR';
    default:
      return 'FIXED';
  }
}

function fromSalaryModeDto(mode: ApiSalaryMode | null | undefined): SalaryMode | null {
  switch (mode) {
    case 'PER_WORKED_DAY':
      return 'par_jour';
    case 'PER_HOUR':
      return 'par_heure';
    case 'FIXED':
      return 'fixe';
    default:
      return null;
  }
}

/** Libellé lisible — `DocumentType` (signature-service) n'a pas de distinction bulletin/trimestre ici, seulement le type. */
const DOCUMENT_TYPE_LABEL: Record<ApiDocumentType, string> = {
  BULLETIN: 'Bulletin',
  CERTIFICATE: 'Certificat',
  OFFICIAL: 'Document officiel',
  ATTESTATION: 'Attestation',
  RELEVE_NOTES: 'Relevé de notes',
  PAYSLIP: 'Bulletin de paie',
  OTHER: 'Autre document',
};

function fromSignatureRecordResponse(dto: SignatureRecordResponseDto, cible: string): SignedDocument {
  return {
    serie: dto.serialNumber ?? '—',
    type: DOCUMENT_TYPE_LABEL[dto.documentType],
    cible,
    cibleKind: 'personnel',
    date: isoToFR(dto.signedAt.slice(0, 10)),
    signataire: dto.signerName,
    downloadUrl: dto.downloadUrl ?? null,
  };
}

function fromPayslipResponse(dto: PayslipResponseDto): SalarySlip {
  return {
    id: dto.id,
    teacherId: dto.staffUserId,
    periode: dto.periodLabel,
    salaryMode: fromSalaryModeDto(dto.salaryMode) ?? 'fixe',
    montantBrut: dto.grossAmountFcfa,
    joursTravailles: dto.workedDays ?? null,
    heuresTravaillees: dto.workedHours ?? null,
    joursAbsenceInjustifiee: dto.unjustifiedAbsenceDays ?? null,
    payeurEtat: dto.payerOwnership === 'PUBLIC',
    dateGeneration: dto.generatedAt ? isoToFR(dto.generatedAt.slice(0, 10)) : '—',
  };
}

function fromUserResponse(dto: UserResponseDto, classNames: string[], salaryProfile?: SchoolSalaryProfileResponseDto): Teacher {
  return {
    id: dto.id,
    nom: `${dto.firstName} ${dto.lastName}`,
    photoUrl: dto.photoUrl ?? null,
    subjectIds: dto.subjectIds ?? [],
    tel: dto.phone ?? '—',
    email: dto.email ?? '—',
    statut: fromAccountStatus(dto.accountStatus),
    classes: classNames,
    salaryMode: fromSalaryModeDto(salaryProfile?.salaryMode),
    salaireFixe: salaryProfile?.fixedAmountFcfa ?? null,
    tauxJournalier: salaryProfile?.dailyRateFcfa ?? null,
    tauxHoraire: salaryProfile?.hourlyRateFcfa ?? null,
  };
}

/**
 * Lecture du profil de rémunération — absente tant qu'aucun salaire n'a
 * jamais été configuré pour ce couple enseignant/école n'empêche PAS la
 * réponse (`SchoolSalaryProfileResponse.salaryMode` vaut alors `null`) ;
 * seule l'absence d'un profil d'école ACTIF (cas impossible ici, l'enseignant
 * vient de cette école) renverrait une 404 — `undefined` en repli pour ne
 * jamais faire échouer l'affichage de la fiche pour autant.
 */
async function fetchSalaryProfile(teacherId: string, schoolId: string): Promise<SchoolSalaryProfileResponseDto | undefined> {
  try {
    return await request<SchoolSalaryProfileResponseDto>(
      `/api/v1/users/${encodeURIComponent(teacherId)}/schools/${encodeURIComponent(schoolId)}/salary`,
    );
  } catch (err) {
    // Repli volontaire (voir le commentaire ci-dessus) -- mais une erreur ici
    // n'est plus censée masquer un enregistrement réussi : `updateSalary`
    // n'en dépend plus pour afficher le salaire qu'il vient de sauvegarder.
    // Le console.error garde une trace de ce cas "impossible" s'il se
    // reproduit, plutôt que de disparaître silencieusement.
    console.error('fetchSalaryProfile a échoué (repli sur "non configuré")', err);
    return undefined;
  }
}

function classNamesForTeacher(teacherId: string, classesDtos: ClassInfoDto[]): string[] {
  return classesDtos.filter((c) => c.teacherIds.includes(teacherId)).map((c) => c.fullName);
}

/** Prénom / nom — même découpage « premier mot / reste » que `students.api.ts` pour une saisie « Nom complet » unique. */
function splitName(nomComplet: string): { firstName: string; lastName: string } {
  const parts = nomComplet.trim().split(/\s+/);
  return { firstName: parts[0] ?? nomComplet, lastName: parts.slice(1).join(' ') || (parts[0] ?? nomComplet) };
}

/**
 * Portage réel complet — `user-service` (`UserController`), `class-service`
 * (itinérants), `payment-service` (`listPayslips`) et le salaire
 * (`updateSalary`, `user-service`). `listDocuments` utilise
 * `GET /api/v1/signatures/document/{schoolId}/{documentRef}`
 * (signature-service) avec `documentRef = teacherId` — même champ que pour
 * un bulletin (voir le commentaire de `SignatureRecord.documentRef` côté
 * backend : « studentId ou classId selon le type », en réalité n'importe
 * quel id sujet du document, personnel compris).
 */
const SCHEDULE_DAY_LABEL: Record<string, TeacherScheduleSlot['jour']> = {
  MON: 'Lundi',
  TUE: 'Mardi',
  WED: 'Mercredi',
  THU: 'Jeudi',
  FRI: 'Vendredi',
  SAT: 'Samedi',
};

const API_EXAM_TO_EVENT: Record<ApiExamType, EventType> = {
  DEVOIR1: 'Devoir',
  DEVOIR2: 'Devoir',
  COMPOSITION: 'Composition',
  INTERRO: 'Devoir',
  EXAMEN_BLANC: 'Examen',
  CONSEIL_DE_CLASSE: 'Conseil de classe',
};

function examIsoToFr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** `ExamCalendarResponse` → `ClassEvent` (vue prof multi-classes, nom de classe inclus). */
function fromTeacherExam(dto: ExamCalendarResponseDto): ClassEvent {
  return {
    id: dto.id,
    classeId: dto.classId,
    classe: dto.className ?? null,
    type: API_EXAM_TO_EVENT[dto.type],
    titre: dto.title,
    subjectId: dto.subjectId,
    matiere: dto.subjectName,
    teacherId: dto.teacherId,
    professeur: dto.teacherName,
    semestre: (dto.semesterNumber === 2 ? 2 : 1) as 1 | 2,
    date: examIsoToFr(dto.date),
    heureDebut: dto.startTime,
    heureFin: dto.endTime,
    salle: dto.room,
    notes: '',
  };
}

export function createTeachersApi(): TeachersPort {
  async function getOne(teacherId: string): Promise<Teacher> {
    const { schoolId } = sessionContext();
    const [dto, classesDtos, salaryProfile] = await Promise.all([
      request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(teacherId)}`),
      fetchSchoolClasses(schoolId),
      fetchSalaryProfile(teacherId, schoolId),
    ]);
    return fromUserResponse(dto, classNamesForTeacher(teacherId, classesDtos), salaryProfile);
  }

  async function setSubjects(teacherId: string, subjectIds: string[]): Promise<void> {
    const { schoolId } = sessionContext();
    const body: UpdateSubjectsRequestDto = { subjectIds };
    await request<UserResponseDto>(
      `/api/v1/users/${encodeURIComponent(teacherId)}/schools/${encodeURIComponent(schoolId)}/subjects`,
      { method: 'PUT', body },
    );
  }

  return {
    async list(): Promise<Teacher[]> {
      const { schoolId } = sessionContext();
      const [teacherDtos, instituteurDtos, classesDtos] = await Promise.all([
        request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(schoolId)}`, {
          query: { role: 'TEACHER' },
        }),
        request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(schoolId)}`, {
          query: { role: 'INSTITUTEUR' },
        }),
        fetchSchoolClasses(schoolId),
      ]);
      return [...teacherDtos, ...instituteurDtos].map((dto) =>
        fromUserResponse(dto, classNamesForTeacher(dto.id, classesDtos)),
      );
    },

    get: getOne,

    /** Évaluations planifiées par ce professeur — `GET /exams/teacher/{id}?schoolId` (schedule-service). */
    async getPlannedEvaluations(teacherId): Promise<ClassEvent[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<ExamCalendarResponseDto[]>(
        `/api/v1/exams/teacher/${encodeURIComponent(teacherId)}`,
        { query: { schoolId } },
      );
      return dtos.map(fromTeacherExam).sort((a, b) => frToISO(a.date).localeCompare(frToISO(b.date)));
    },

    async getSchedule(teacherId): Promise<TeacherScheduleSlot[]> {
      const { schoolId } = sessionContext();
      const [slots, classesDtos] = await Promise.all([
        request<TimetableSlotResponseDto[]>(`/api/v1/timetables/teacher/${encodeURIComponent(teacherId)}`, {
          query: { schoolId },
        }),
        fetchSchoolClasses(schoolId),
      ]);
      const classNameById = new Map(classesDtos.map((c) => [c.id, c.fullName]));
      // Déduplication défensive : un enseignant n'a qu'un créneau à un moment
      // donné — on collapse tout doublon d'affichage (jour/horaire/classe/matière/salle).
      const seen = new Set<string>();
      return slots
        .filter((dto) => !dto.grayedOut)
        .map((dto) => ({
          jour: SCHEDULE_DAY_LABEL[dto.dayOfWeek] ?? 'Lundi',
          heureDebut: dto.startTime,
          heureFin: dto.endTime,
          matiere: dto.subjectName ?? null,
          classe: classNameById.get(dto.classId) ?? '—',
          salle: dto.room ?? null,
          remplacant: dto.replacementTeacherName ?? null,
        }))
        .filter((slot) => {
          const key = `${slot.jour}|${slot.heureDebut}|${slot.heureFin}|${slot.classe}|${slot.matiere ?? ''}|${slot.salle ?? ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    },

    async create(input): Promise<Teacher> {
      const { schoolId } = sessionContext();
      const { firstName, lastName } = splitName(input.nom);
      const body: CreateUserRequestDto = {
        schoolId,
        role: 'TEACHER',
        firstName,
        lastName,
        phone: input.tel,
        email: input.email === '—' ? undefined : input.email,
        status: 'ACTIVE',
      };
      const dto = await request<UserResponseDto>('/api/v1/users', { method: 'POST', body });
      if (input.subjectIds.length > 0) await setSubjects(dto.id, input.subjectIds);
      return getOne(dto.id);
    },

    async findByPhone(tel: string): Promise<TeacherLookupResult | null> {
      const { schoolId } = sessionContext();
      let lookup: UserLookupResponseDto;
      try {
        lookup = await request<UserLookupResponseDto>(`/api/v1/users/by-phone/${encodeURIComponent(tel)}`);
      } catch {
        return null;
      }
      const dto = await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(lookup.id)}`);
      const dejaDansCetEtablissement = lookup.schoolProfiles.some(
        (p) => p.schoolId === schoolId && p.status === 'ACTIVE',
      );
      return {
        userId: lookup.id,
        nom: `${dto.firstName} ${dto.lastName}`,
        tel: dto.phone ?? tel,
        email: dto.email ?? '—',
        dejaDansCetEtablissement,
      };
    },

    async attachExisting(userId: string, subjectIds: string[]): Promise<Teacher> {
      const { schoolId } = sessionContext();
      const body: AddToSchoolRequestDto = { schoolId, role: 'TEACHER', isItinerant: false };
      await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(userId)}/schools`, {
        method: 'POST',
        body,
      });
      if (subjectIds.length > 0) await setSubjects(userId, subjectIds);
      return getOne(userId);
    },

    async update(teacherId: string, patch): Promise<Teacher> {
      const body: UpdateUserRequestDto = {};
      if (patch.nom !== undefined) {
        const { firstName, lastName } = splitName(patch.nom);
        body.firstName = firstName;
        body.lastName = lastName;
      }
      if (patch.tel !== undefined) body.phone = patch.tel;
      if (patch.email !== undefined) body.email = patch.email;
      if (patch.statut !== undefined) body.status = toAccountStatus(patch.statut);
      if (Object.keys(body).length > 0) {
        await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(teacherId)}`, { method: 'PUT', body });
      }
      if (patch.subjectIds !== undefined) await setSubjects(teacherId, patch.subjectIds);
      return getOne(teacherId);
    },

    /**
     * Backend : `PUT /api/v1/users/{userId}/schools/{schoolId}/salary`
     * (user-service) — un seul des trois montants est pertinent selon
     * `salaryMode`, validé côté serveur (`UserServiceImpl.validateSalaryAmounts`).
     */
    async updateSalary(teacherId, input): Promise<Teacher> {
      const { schoolId } = sessionContext();
      const body: UpdateSalaryRequestDto = {
        salaryMode: toSalaryModeDto(input.salaryMode),
        fixedAmountFcfa: input.salaryMode === 'fixe' ? input.salaireFixe ?? undefined : undefined,
        dailyRateFcfa: input.salaryMode === 'par_jour' ? input.tauxJournalier ?? undefined : undefined,
        hourlyRateFcfa: input.salaryMode === 'par_heure' ? input.tauxHoraire ?? undefined : undefined,
      };
      const saved = await request<SchoolSalaryProfileResponseDto>(
        `/api/v1/users/${encodeURIComponent(teacherId)}/schools/${encodeURIComponent(schoolId)}/salary`,
        { method: 'PUT', body },
      );
      const teacher = await getOne(teacherId);
      // CORRECTION (bug signalé, écoles privées) : `getOne` relit le salaire via
      // `fetchSalaryProfile`, qui avale TOUTE erreur de lecture (voir son
      // commentaire) -- une erreur transitoire sur cette seule relecture donnait
      // l'impression que l'enregistrement n'avait pas eu lieu, alors que le PUT
      // ci-dessus avait bien réussi. La réponse du PUT EST la confirmation
      // serveur de ce qui vient d'être écrit ; on lui fait confiance plutôt qu'à
      // une relecture qui peut échouer indépendamment.
      return {
        ...teacher,
        salaryMode: fromSalaryModeDto(saved.salaryMode),
        salaireFixe: saved.fixedAmountFcfa ?? null,
        tauxJournalier: saved.dailyRateFcfa ?? null,
        tauxHoraire: saved.hourlyRateFcfa ?? null,
      };
    },

    /** Backend : `GET /api/v1/accounting/salary-requests/payslips?schoolId&staffUserId` (payment-service). */
    async listPayslips(teacherId): Promise<SalarySlip[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<PayslipResponseDto[]>('/api/v1/accounting/salary-requests/payslips', {
        query: { schoolId, staffUserId: teacherId },
      });
      return dtos
        .map(fromPayslipResponse)
        .sort((a, b) => frToISO(b.dateGeneration).localeCompare(frToISO(a.dateGeneration)));
    },

    // CORRECTION (signalé) — « il doit pouvoir prévisualiser avec des
    // options cacheter/signer/télécharger (avec ou sans cachet/signer) » :
    // le PDF non signé, la même route que celle déjà utilisée pour
    // embarquer le document dans la signature (`signatures.signPayslip`,
    // voir `fetchPayslipPdfBase64`) et pour le bouton "Télécharger" côté
    // comptable (`salaryPayments.api.ts#downloadPayslipPdf`) -- le rôle
    // DIRECTOR est déjà autorisé dessus (voir
    // PayslipPdfServiceImpl.STAFF_WIDE_ROLES côté backend).
    async getPayslipPdfBlob(payslipId): Promise<Blob> {
      return request<Blob>(`/api/v1/accounting/salary-requests/payslips/${encodeURIComponent(payslipId)}/pdf`, {
        responseType: 'blob',
      });
    },

    async downloadPayslipPdf(payslipId, teacherNom): Promise<void> {
      const blob = await request<Blob>(
        `/api/v1/accounting/salary-requests/payslips/${encodeURIComponent(payslipId)}/pdf`,
        { responseType: 'blob' },
      );
      const [firstName, ...rest] = teacherNom.trim().split(/\s+/);
      downloadBlob(blob, buildDownloadFilename('fiche_de_paie', firstName ?? '', rest.join(' ')));
    },

    async remove(teacherId: string): Promise<void> {
      const { schoolId } = sessionContext();
      await request<void>(`/api/v1/users/${encodeURIComponent(teacherId)}`, {
        method: 'DELETE',
        query: { schoolId },
      });
    },

    async addClass(teacherId: string, classId: string): Promise<Teacher> {
      await request<unknown>(
        `/api/v1/classes/${encodeURIComponent(classId)}/itinerant-teachers/${encodeURIComponent(teacherId)}`,
        { method: 'POST' },
      );
      return getOne(teacherId);
    },

    async removeClass(teacherId: string, classId: string): Promise<Teacher> {
      await request<unknown>(
        `/api/v1/classes/${encodeURIComponent(classId)}/itinerant-teachers/${encodeURIComponent(teacherId)}`,
        { method: 'DELETE' },
      );
      return getOne(teacherId);
    },

    /** Backend : `GET /api/v1/signatures/document/{schoolId}/{documentRef}` (signature-service). */
    async listDocuments(teacherId): Promise<SignedDocument[]> {
      const { schoolId } = sessionContext();
      const [dtos, teacher] = await Promise.all([
        request<SignatureRecordResponseDto[]>(
          `/api/v1/signatures/document/${encodeURIComponent(schoolId)}/${encodeURIComponent(teacherId)}`,
        ),
        getOne(teacherId),
      ]);
      return dtos
        .filter((d) => d.valid)
        .map((d) => fromSignatureRecordResponse(d, teacher.nom))
        .sort((a, b) => frToISO(b.date).localeCompare(frToISO(a.date)));
    },
  };
}
