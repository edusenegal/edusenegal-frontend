import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type { LedgerHistoryResponseDto, LedgerResponseDto } from '@/types/api';
import type { LedgerPort } from '@/services/ports';
import type { LedgerGranularity, LedgerHistory, SchoolLedger } from '@/types/domain';
import { isoToFR } from '@/utils/format';

/** "2026-11-05T10:30:00" → "05/11/2026 10:30". */
function isoDateTimeToFR(iso: string | null): string | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);
  return timePart ? `${isoToFR(datePart)} ${timePart}` : isoToFR(datePart);
}

function fromApiLedger(dto: LedgerResponseDto): SchoolLedger {
  return {
    totalEncaissements: dto.totalIncomesFcfa,
    totalDepenses: dto.totalExpensesFcfa,
    solde: dto.balanceFcfa,
    derniereMajLe: isoDateTimeToFR(dto.lastUpdatedAt),
  };
}

function fromApiHistory(dto: LedgerHistoryResponseDto): LedgerHistory {
  return {
    granularite: dto.granularity as LedgerGranularity,
    points: dto.points.map((p) => ({
      period: p.period,
      entreesFcfa: p.incomesFcfa,
      sortiesFcfa: p.expensesFcfa,
    })),
    totalEntreesFcfa: dto.totalIncomesFcfa,
    totalSortiesFcfa: dto.totalExpensesFcfa,
    solde: dto.balanceFcfa,
  };
}

export function createLedgerApi(): LedgerPort {
  return {
    async get(): Promise<SchoolLedger> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const dto = await request<LedgerResponseDto>('/api/v1/accounting/ledger', {
        query: { schoolId, academicYearId },
      });
      return fromApiLedger(dto);
    },

    async getHistory(granularity: LedgerGranularity, from: string, to: string): Promise<LedgerHistory> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const dto = await request<LedgerHistoryResponseDto>('/api/v1/accounting/ledger/history', {
        query: { schoolId, academicYearId, granularity, from, to },
      });
      return fromApiHistory(dto);
    },
  };
}
