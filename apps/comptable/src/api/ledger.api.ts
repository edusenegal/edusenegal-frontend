import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type { LedgerResponseDto } from '@/types/api';
import type { LedgerPort } from '@/services/ports';
import type { SchoolLedger } from '@/types/domain';
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
  };
}
