import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import { AppError } from '@/services/errors';
import { isoToFR } from '@/utils/format';
import type { ClassPaymentStatsDto } from '@/types/api';
import type { PaymentConfigPort } from '@/services/ports';
import type { PaymentChannel, PaymentConfig, PaymentType } from '@/types/domain';

/**
 * Portage réel partiel — taux de recouvrement agrégé ET par élève pour un
 * sous-ensemble d'élèves (débloque « Taux de paiement » sur
 * `ClassDetailPage`, agrégé et par élève — task #208). `get`/`save`
 * (configuration tarifaire, tâche #187) tapent payment-service par école
 * (`GET/POST /payments/config`).
 */
// ── Mapping enums front (minuscule) ↔ payment-service (MAJUSCULE) ──
const TYPE_TO_API: Record<PaymentType, string> = {
  inscription_seule: 'INSCRIPTION_ONLY',
  mensuel: 'MONTHLY',
  trimestriel: 'QUARTERLY',
  annuel: 'ANNUAL',
  inscription_mensuel: 'INSCRIPTION_MONTHLY',
  inscription_trimestriel: 'INSCRIPTION_QUARTERLY',
  inscription_annuel: 'INSCRIPTION_ANNUAL',
  bourse: 'SCHOLARSHIP',
};
const TYPE_FROM_API = Object.fromEntries(
  Object.entries(TYPE_TO_API).map(([k, v]) => [v, k]),
) as Record<string, PaymentType>;

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

interface LevelPricingDto {
  level: string;
  series: string | null;
  displayName: string;
  inscriptionFcfa: number;
  periodFcfa: number;
  totalAnnualFcfa: number;
}
interface PaymentConfigResponseDto {
  id: string;
  schoolId: string;
  type: string;
  levelPricings: LevelPricingDto[];
  installmentAllowed: boolean;
  maxInstallments: number;
  deferredAllowed: boolean;
  maxDeferDays: number;
  alertDaysBefore: number;
  enabledChannels: string[];
  updatedAt: string;
}

function fromConfigResponse(dto: PaymentConfigResponseDto): PaymentConfig {
  return {
    id: dto.id,
    type: TYPE_FROM_API[dto.type] ?? 'inscription_trimestriel',
    levelPricings: (dto.levelPricings ?? []).map((lp) => ({
      level: lp.level,
      series: lp.series ?? null,
      displayName: lp.displayName,
      inscriptionFcfa: lp.inscriptionFcfa ?? 0,
      periodFcfa: lp.periodFcfa ?? 0,
      totalAnnualFcfa: lp.totalAnnualFcfa ?? 0,
    })),
    installmentAllowed: dto.installmentAllowed,
    maxInstallments: dto.maxInstallments,
    deferredAllowed: dto.deferredAllowed,
    maxDeferDays: dto.maxDeferDays,
    alertDaysBefore: dto.alertDaysBefore,
    enabledChannels: (dto.enabledChannels ?? [])
      .map((c) => CHANNEL_FROM_API[c])
      .filter((c): c is PaymentChannel => Boolean(c)),
    updatedAt: dto.updatedAt ? isoToFR(dto.updatedAt.slice(0, 10)) : '—',
  };
}

export function createPaymentsApi(): Pick<
  PaymentConfigPort,
  'get' | 'save' | 'getCollectionRateForStudents' | 'getPaymentRatesForStudents' | 'getClassStats'
> {
  async function fetchStats(studentIds: string[], classId?: string): Promise<ClassPaymentStatsDto | null> {
    if (studentIds.length === 0) return null;
    const { schoolId } = sessionContext();
    const yearId = await resolveYearId();
    return request<ClassPaymentStatsDto>('/api/v1/payments/stats/by-students', {
      query: { schoolId, yearId, studentIds: studentIds.join(','), classId },
    });
  }

  return {
    /** payment-service `GET /payments/config/{schoolId}` — `null` si aucune config (404). */
    async get(): Promise<PaymentConfig | null> {
      const { schoolId } = sessionContext();
      try {
        const dto = await request<PaymentConfigResponseDto>(
          `/api/v1/payments/config/${encodeURIComponent(schoolId)}`,
        );
        return fromConfigResponse(dto);
      } catch (err) {
        if (err instanceof AppError && err.kind === 'notFound') return null;
        throw err;
      }
    },

    /** payment-service `POST /payments/config` — upsert par école. */
    async save(input: Omit<PaymentConfig, 'id' | 'updatedAt'>): Promise<PaymentConfig> {
      const { schoolId } = sessionContext();
      const body = {
        schoolId,
        type: TYPE_TO_API[input.type],
        levelPricings: input.levelPricings.map((lp) => ({
          level: lp.level,
          series: lp.series,
          displayName: lp.displayName,
          inscriptionFcfa: lp.inscriptionFcfa,
          periodFcfa: lp.periodFcfa,
          totalAnnualFcfa: lp.totalAnnualFcfa,
        })),
        installmentAllowed: input.installmentAllowed,
        maxInstallments: input.maxInstallments,
        deferredAllowed: input.deferredAllowed,
        maxDeferDays: input.maxDeferDays,
        alertDaysBefore: input.alertDaysBefore,
        enabledChannels: input.enabledChannels.map((c) => CHANNEL_TO_API[c]),
      };
      const dto = await request<PaymentConfigResponseDto>('/api/v1/payments/config', { method: 'POST', body });
      return fromConfigResponse(dto);
    },

    async getCollectionRateForStudents(studentIds: string[], classId?: string): Promise<number | null> {
      const stats = await fetchStats(studentIds, classId);
      return stats ? stats.collectionRate : null;
    },

    async getPaymentRatesForStudents(studentIds: string[], classId?: string): Promise<Record<string, number>> {
      const stats = await fetchStats(studentIds, classId);
      const result: Record<string, number> = {};
      if (!stats) return result;
      for (const row of stats.byStudent) {
        result[row.studentId] = row.collectionRate;
      }
      return result;
    },

    async getClassStats(studentIds: string[], classId?: string) {
      const stats = await fetchStats(studentIds, classId);
      if (!stats) return null;
      return {
        totalStudents: stats.totalStudents,
        totalExpectedFcfa: stats.totalExpectedFcfa,
        totalCollectedFcfa: stats.totalCollectedFcfa,
        totalRemainingFcfa: stats.totalRemainingFcfa,
        collectionRate: stats.collectionRate,
      };
    },
  };
}
