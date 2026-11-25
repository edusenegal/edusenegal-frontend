import { request, sessionContext } from '@/api/client';
import type {
  ApiSalaryMode,
  CreateUserRequestDto,
  SchoolSalaryProfileResponseDto,
  UpdateSalaryRequestDto,
  UpdateUserRequestDto,
  UserResponseDto,
} from '@/types/api';
import type { PersonnelPort } from '@/services/ports';
import type { SalaryMode, StaffMember, StaffStatus, StaffSalaryProfile } from '@/types/domain';

/** Rôles exclus de l'écran « Personnel » : les enseignants ont leur propre
 *  écran (« Enseignants »), la direction ne se gère pas elle-même, et les
 *  élèves/parents ne sont pas du personnel. */
const EXCLUDED_ROLES = new Set<string>([
  // Les enseignants sont désormais INCLUS (demande direction) — ils gardent
  // aussi leur écran dédié « Enseignants ». On exclut seulement la direction
  // (pas d'auto-gestion) et les apprenants/familles (pas du personnel).
  'DIRECTOR',
  'STUDENT',
  'PHD_STUDENT',
  'PARENT',
  'GUARDIAN',
]);

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

function fromUserResponse(dto: UserResponseDto): StaffMember {
  return {
    id: dto.id,
    prenom: dto.firstName,
    nom: dto.lastName,
    role: dto.role,
    tel: dto.phone ?? '—',
    email: dto.email ?? '—',
    statut: fromAccountStatus(dto.accountStatus),
    photoUrl: dto.photoUrl ?? null,
    salaryMode: fromSalaryModeDto(dto.salaryMode),
    salaireFixe: dto.fixedAmountFcfa ?? null,
    tauxJournalier: dto.dailyRateFcfa ?? null,
    tauxHoraire: dto.hourlyRateFcfa ?? null,
  };
}

/**
 * Personnel non enseignant — `user-service` (`UserController`). Réutilise les
 * routes CRUD génériques `/users` (create/update/delete), la liste dédiée
 * `/users/school/{schoolId}/staff/full`, et le blocage `/users/{id}/block`
 * et `/unblock` (mêmes endpoints que la fiche élève).
 */
export function createPersonnelApi(): PersonnelPort {
  return {
    async list(): Promise<StaffMember[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<UserResponseDto[]>(
        `/api/v1/users/school/${encodeURIComponent(schoolId)}/staff/full`,
      );
      return dtos.filter((d) => !EXCLUDED_ROLES.has(d.role)).map(fromUserResponse);
    },

    async create(input): Promise<StaffMember> {
      const { schoolId } = sessionContext();
      const body: CreateUserRequestDto = {
        schoolId,
        role: input.role as CreateUserRequestDto['role'],
        firstName: input.prenom,
        lastName: input.nom,
        phone: input.tel,
        email: input.email && input.email !== '—' ? input.email : undefined,
        sexe: input.sexe === 'F' ? 'FEMININ' : input.sexe === 'M' ? 'MASCULIN' : undefined,
        status: 'ACTIVE',
      };
      const dto = await request<UserResponseDto>('/api/v1/users', { method: 'POST', body });
      return fromUserResponse(dto);
    },

    async update(id, patch): Promise<StaffMember> {
      const body: UpdateUserRequestDto = {};
      if (patch.prenom !== undefined) body.firstName = patch.prenom;
      if (patch.nom !== undefined) body.lastName = patch.nom;
      if (patch.tel !== undefined) body.phone = patch.tel;
      if (patch.email !== undefined) body.email = patch.email;
      const dto = await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body,
      });
      return fromUserResponse(dto);
    },

    async remove(id): Promise<void> {
      const { schoolId } = sessionContext();
      await request<void>(`/api/v1/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        query: { schoolId },
      });
    },

    async block(id): Promise<void> {
      const { schoolId } = sessionContext();
      await request<unknown>(`/api/v1/users/${encodeURIComponent(id)}/block`, {
        method: 'PATCH',
        query: { schoolId },
      });
    },

    async unblock(id): Promise<void> {
      const { schoolId } = sessionContext();
      await request<unknown>(`/api/v1/users/${encodeURIComponent(id)}/unblock`, {
        method: 'PATCH',
        query: { schoolId },
      });
    },

    async getSalaryProfile(userId): Promise<StaffSalaryProfile> {
      const { schoolId } = sessionContext();
      const dto = await request<SchoolSalaryProfileResponseDto>(
        `/api/v1/users/${encodeURIComponent(userId)}/schools/${encodeURIComponent(schoolId)}/salary`,
      );
      return {
        salaryMode: fromSalaryModeDto(dto.salaryMode),
        salaireFixe: dto.fixedAmountFcfa ?? null,
        tauxJournalier: dto.dailyRateFcfa ?? null,
        tauxHoraire: dto.hourlyRateFcfa ?? null,
      };
    },

    async updateSalary(userId, input): Promise<void> {
      const { schoolId } = sessionContext();
      const body: UpdateSalaryRequestDto = {
        salaryMode: toSalaryModeDto(input.salaryMode),
        fixedAmountFcfa: input.salaireFixe ?? undefined,
        dailyRateFcfa: input.tauxJournalier ?? undefined,
        hourlyRateFcfa: input.tauxHoraire ?? undefined,
      };
      await request<SchoolSalaryProfileResponseDto>(
        `/api/v1/users/${encodeURIComponent(userId)}/schools/${encodeURIComponent(schoolId)}/salary`,
        { method: 'PUT', body },
      );
    },
  };
}
