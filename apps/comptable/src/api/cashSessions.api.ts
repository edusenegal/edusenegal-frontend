import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import { AppError } from '@/services/errors';
import { fromApiTransaction } from '@/api/payments.api';
import type {
  ApiPaymentChannel,
  CashSessionResponseDto,
  CloseCashSessionRequestDto,
  PaymentTransactionResponseDto,
} from '@/types/api';
import type { CashSessionsPort } from '@/services/ports';
import type { CashIncomeEntry, CashSession, CashSessionIncomeLine, PaymentChannel } from '@/types/domain';
import { frToISO, isoToFR } from '@/utils/format';

const CHANNEL_FROM_API: Record<ApiPaymentChannel, PaymentChannel> = {
  WAVE: 'wave',
  ORANGE_MONEY: 'orange_money',
  CASH: 'especes',
  CHEQUE: 'cheque',
  VIREMENT_BANCAIRE: 'virement_bancaire',
};

/** "2026-11-05T10:30:00" → "05/11/2026 10:30". */
function isoDateTimeToFR(iso: string | null): string | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);
  return timePart ? `${isoToFR(datePart)} ${timePart}` : isoToFR(datePart);
}

function fromApiCashSession(dto: CashSessionResponseDto): CashSession {
  const incomeByChannel = dto.incomeByChannel ?? {};
  const encaissementsParCanal: CashSessionIncomeLine[] = Object.entries(incomeByChannel).map(([canal, montant]) => ({
    canal: CHANNEL_FROM_API[canal as ApiPaymentChannel] ?? 'especes',
    montantFcfa: montant ?? 0,
  }));

  return {
    id: dto.id,
    cashierId: dto.cashierId,
    dateSession: isoToFR(dto.sessionDate),
    statut: dto.status === 'OPEN' ? 'ouverte' : 'cloturee',
    encaissementsParCanal,
    totalEncaissements: dto.totalIncomesFcfa,
    totalDepenses: dto.totalExpensesFcfa,
    soldeTheorique: dto.theoreticalBalance,
    comptagePhysique: dto.physicalCountFcfa,
    ecart: dto.gapFcfa,
    justificationEcart: dto.gapJustification,
    ouvertureLe: isoDateTimeToFR(dto.openedAt) ?? '—',
    clotureLe: isoDateTimeToFR(dto.closedAt),
  };
}

export function createCashSessionsApi(): CashSessionsPort {
  return {
    async open(): Promise<CashSession> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const dto = await request<CashSessionResponseDto>('/api/v1/accounting/cash-sessions/open', {
        method: 'POST',
        query: { schoolId, academicYearId },
      });
      return fromApiCashSession(dto);
    },

    async close(physicalCountFcfa, gapJustification): Promise<CashSession> {
      const { schoolId } = sessionContext();
      const body: CloseCashSessionRequestDto = { physicalCountFcfa, gapJustification };
      const dto = await request<CashSessionResponseDto>('/api/v1/accounting/cash-sessions/close', {
        method: 'POST',
        query: { schoolId },
        body,
      });
      return fromApiCashSession(dto);
    },

    async getCurrent(): Promise<CashSession | null> {
      const { schoolId } = sessionContext();
      try {
        const dto = await request<CashSessionResponseDto>('/api/v1/accounting/cash-sessions/current', {
          query: { schoolId },
        });
        return fromApiCashSession(dto);
      } catch (error) {
        // 404 : aucune session ouverte aujourd'hui pour ce comptable — état
        // normal avant le premier `open()` de la journée, pas une anomalie.
        if (error instanceof AppError && error.kind === 'notFound') {
          return null;
        }
        throw error;
      }
    },

    async getHistory(from, to): Promise<CashSession[]> {
      const { schoolId } = sessionContext();
      const list = await request<CashSessionResponseDto[]>('/api/v1/accounting/cash-sessions/history', {
        query: { schoolId, from: frToISO(from), to: frToISO(to) },
      });
      return list.map(fromApiCashSession);
    },

    async listTodayIncomes(): Promise<CashIncomeEntry[]> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const list = await request<PaymentTransactionResponseDto[]>(
        `/api/v1/payments/school/${encodeURIComponent(schoolId)}/today`,
        { query: { academicYearId } },
      );
      return list.map((dto) => ({ ...fromApiTransaction(dto), studentId: dto.studentId }));
    },
  };
}
