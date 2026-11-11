import { request } from '@/api/client';
import { downloadBlob } from '@/utils/format';

/** Type de document signé — calqué sur `DocumentType` (signature-service). */
export type SignedDocType =
  | 'BULLETIN'
  | 'CERTIFICATE'
  | 'OFFICIAL'
  | 'ATTESTATION'
  | 'RELEVE_NOTES'
  | 'PAYSLIP'
  | 'OTHER';

export interface MySignedDocument {
  id: string;
  documentType: SignedDocType;
  signatureHash: string;
  serialNumber: string | null;
  signerName: string | null;
  signedAt: string | null;
}

interface SignatureRecordDto {
  id: string;
  documentType: SignedDocType;
  signatureHash: string;
  serialNumber?: string | null;
  signerName?: string | null;
  signedAt?: string | null;
}

/**
 * Documents signés dont l'enseignant connecté est la personne concernée
 * (ex. une attestation signée par le directeur). Le périmètre vient du jeton
 * côté backend (`GET /api/v1/signatures/me`).
 */
export async function getMySignedDocuments(): Promise<MySignedDocument[]> {
  const rows = await request<SignatureRecordDto[]>('/api/v1/signatures/me');
  return rows
    .map((r) => ({
      id: r.id,
      documentType: r.documentType,
      signatureHash: r.signatureHash,
      serialNumber: r.serialNumber ?? null,
      signerName: r.signerName ?? null,
      signedAt: r.signedAt ?? null,
    }))
    .sort((a, b) => (b.signedAt ?? '').localeCompare(a.signedAt ?? ''));
}

/**
 * Téléchargement du PDF signé — on récupère les octets via l'endpoint dédié
 * (qui autorise déjà le destinataire) puis on déclenche le téléchargement
 * localement, sans dépendre d'une URL externe.
 */
export async function downloadSignedDocument(signatureHash: string, filename: string): Promise<void> {
  const blob = await request<Blob>(
    `/api/v1/signatures/${encodeURIComponent(signatureHash)}/download`,
    { responseType: 'blob' },
  );
  downloadBlob(blob, filename);
}
