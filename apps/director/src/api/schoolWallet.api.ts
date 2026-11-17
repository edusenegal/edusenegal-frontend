import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import { isoToFR } from '@/utils/format';
import type { SchoolWalletPort } from '@/services/ports';
import type {
  Cashout,
  CashoutStatus,
  CashoutValidators,
  PaymentChannel,
  SchoolWallet,
  WalletEntry,
} from '@/types/domain';

/**
 * SenÉtude Pay — portage réel de la trésorerie (payment-service) :
 * `GET /payments/school-wallet`, `GET|PUT /payments/cashouts/config`,
 * `GET|POST /payments/cashouts`, `POST /payments/cashouts/{id}/approve|reject|resend-otp`.
 */
const CHANNEL_TO_API: Record<PaymentChannel, string> = {
  wave: 'WAVE',
  orange_money: 'ORANGE_MONEY',
  especes: 'CASH',
  cheque: 'CHEQUE',
  virement_bancaire: 'VIREMENT_BANCAIRE',
};
const CHANNEL_FROM_API = Object.fromEntries(
  Object.entries(CHANNEL_TO_API).map(([k, v]) => [v, k]),
) as Record<string, PaymentChannel>;

interface WalletEntryDto {
  id: string;
  direction: 'IN' | 'OUT';
  kind: WalletEntry['kind'];
  amountFcfa: number | null;
  channel: string | null;
  status: string | null;
  label: string | null;
  date: string | null;
  balanceAfterFcfa: number | null;
}
interface SchoolWalletDto {
  balanceFcfa: number | null;
  totalIncomesFcfa: number | null;
  totalExpensesFcfa: number | null;
  entries: WalletEntryDto[];
  page: number | null;
  size: number | null;
  totalEntries: number | null;
  totalPages: number | null;
}
interface CashoutDto {
  id: string;
  amountFcfa: number;
  channel: string;
  destinationPhone: string;
  destinationName: string | null;
  reason: string;
  requestedBy: string;
  status: CashoutStatus;
  failureMessage: string | null;
  externalRef: string | null;
  balanceBeforeFcfa: number | null;
  balanceAfterFcfa: number | null;
  createdAt: string | null;
  executedAt: string | null;
  approvals: { validatorId: string; decision: 'APPROVED' | 'REJECTED' | null; decidedAt: string | null }[];
}

function dateFR(iso: string | null): string {
  return iso ? isoToFR(iso.slice(0, 10)) : '';
}

function fromCashout(dto: CashoutDto): Cashout {
  return {
    id: dto.id,
    amountFcfa: dto.amountFcfa,
    channel: CHANNEL_FROM_API[dto.channel] ?? 'wave',
    destinationPhone: dto.destinationPhone,
    destinationName: dto.destinationName,
    reason: dto.reason,
    requestedBy: dto.requestedBy,
    status: dto.status,
    failureMessage: dto.failureMessage,
    externalRef: dto.externalRef,
    balanceBeforeFcfa: dto.balanceBeforeFcfa,
    balanceAfterFcfa: dto.balanceAfterFcfa,
    createdAt: dateFR(dto.createdAt),
    executedAt: dto.executedAt ? dateFR(dto.executedAt) : null,
    approvals: (dto.approvals ?? []).map((a) => ({
      validatorId: a.validatorId,
      decision: a.decision,
      decidedAt: a.decidedAt ? dateFR(a.decidedAt) : null,
    })),
  };
}

export function createSchoolWalletApi(): SchoolWalletPort {
  return {
    async getWallet(filters = {}): Promise<SchoolWallet> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const params = new URLSearchParams({ schoolId, academicYearId });
      if (filters.direction) params.set('direction', filters.direction);
      if (filters.channel) params.set('channel', CHANNEL_TO_API[filters.channel]);
      if (filters.status) params.set('status', filters.status);
      if (filters.page != null) params.set('page', String(filters.page));
      if (filters.size != null) params.set('size', String(filters.size));
      const dto = await request<SchoolWalletDto>(`/api/v1/payments/school-wallet?${params.toString()}`);
      return {
        balanceFcfa: dto.balanceFcfa ?? 0,
        totalIncomesFcfa: dto.totalIncomesFcfa ?? 0,
        totalExpensesFcfa: dto.totalExpensesFcfa ?? 0,
        entries: (dto.entries ?? []).map((e) => ({
          id: e.id,
          direction: e.direction,
          kind: e.kind,
          amountFcfa: e.amountFcfa ?? 0,
          channel: e.channel ? (CHANNEL_FROM_API[e.channel] ?? null) : null,
          status: e.status ?? '',
          label: e.label ?? '',
          date: dateFR(e.date),
          balanceAfterFcfa: e.balanceAfterFcfa,
        })),
        page: dto.page ?? 0,
        size: dto.size ?? 20,
        totalEntries: dto.totalEntries ?? 0,
        totalPages: dto.totalPages ?? 0,
      };
    },

    async getValidators(): Promise<CashoutValidators> {
      const { schoolId } = sessionContext();
      const dto = await request<{ validatorIds: string[] | null }>(
        `/api/v1/payments/cashouts/config?schoolId=${encodeURIComponent(schoolId)}`,
      );
      return { validatorIds: dto.validatorIds ?? [] };
    },

    async saveValidators(validatorIds): Promise<CashoutValidators> {
      const { schoolId } = sessionContext();
      const dto = await request<{ validatorIds: string[] | null }>('/api/v1/payments/cashouts/config', {
        method: 'PUT',
        body: { schoolId, validatorIds },
      });
      return { validatorIds: dto.validatorIds ?? [] };
    },

    async listCashouts(status): Promise<Cashout[]> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const params = new URLSearchParams({ schoolId, academicYearId });
      if (status) params.set('status', status);
      const list = await request<CashoutDto[]>(`/api/v1/payments/cashouts?${params.toString()}`);
      return list.map(fromCashout);
    },

    async requestCashout(input): Promise<Cashout> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const dto = await request<CashoutDto>('/api/v1/payments/cashouts', {
        method: 'POST',
        body: {
          schoolId,
          academicYearId,
          amountFcfa: input.amountFcfa,
          channel: CHANNEL_TO_API[input.channel],
          destinationPhone: input.destinationPhone,
          destinationName: input.destinationName,
          reason: input.reason,
        },
      });
      return fromCashout(dto);
    },

    async approveCashout(id, otp): Promise<Cashout> {
      const dto = await request<CashoutDto>(`/api/v1/payments/cashouts/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        body: { otp },
      });
      return fromCashout(dto);
    },

    async rejectCashout(id, reason): Promise<Cashout> {
      const dto = await request<CashoutDto>(`/api/v1/payments/cashouts/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        body: { reason },
      });
      return fromCashout(dto);
    },

    async resendOtp(id): Promise<Cashout> {
      const dto = await request<CashoutDto>(`/api/v1/payments/cashouts/${encodeURIComponent(id)}/resend-otp`, {
        method: 'POST',
      });
      return fromCashout(dto);
    },
  };
}
