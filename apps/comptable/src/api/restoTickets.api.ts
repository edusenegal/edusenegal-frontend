import { request } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type { ApiRestoTicketStatus, RestoTicketPurchaseResponseDto } from '@/types/api';
import type { RestoTicketsPort } from '@/services/ports';
import type { RestoTicketPurchase, RestoTicketStatus } from '@/types/domain';
import { isoToFR } from '@/utils/format';

const STATUS_FROM_API: Record<ApiRestoTicketStatus, RestoTicketStatus> = {
  ISSUED: 'emis',
  REDEEMED: 'utilise',
  EXPIRED: 'expire',
  CANCELLED: 'annule',
};

/** "2026-11-05T10:30:00" → "05/11/2026 10:30". */
function isoDateTimeToFR(iso: string | null): string | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);
  return timePart ? `${isoToFR(datePart)} ${timePart}` : isoToFR(datePart);
}

function fromApiPurchase(dto: RestoTicketPurchaseResponseDto): RestoTicketPurchase {
  return {
    id: dto.id,
    ticketTypeLabel: dto.ticketTypeLabel,
    prixFcfa: dto.priceFcfa,
    codeAchat: dto.purchaseCode,
    statut: STATUS_FROM_API[dto.status] ?? 'emis',
    acheteLe: isoDateTimeToFR(dto.purchasedAt) ?? '—',
    expireLe: isoDateTimeToFR(dto.expiresAt),
    utiliseLe: isoDateTimeToFR(dto.redeemedAt),
  };
}

export function createRestoTicketsApi(): RestoTicketsPort {
  return {
    async getHistory(studentId): Promise<RestoTicketPurchase[]> {
      const academicYearId = await resolveYearId();
      const list = await request<RestoTicketPurchaseResponseDto[]>(
        `/api/v1/payments/resto/tickets/student/${encodeURIComponent(studentId)}`,
        { query: { academicYearId } },
      );
      return list.map(fromApiPurchase);
    },
  };
}
