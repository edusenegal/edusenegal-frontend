import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses, resolveYearId } from '@/api/context';
import type {
  ApiPage,
  ClassInfoDto,
  CreateUserRequestDto,
  StudentAbsenceStatsDto,
  UpdateUserRequestDto,
  UserResponseDto,
} from '@/types/api';
import type { StudentsPort } from '@/services/ports';
import type { Student, StudentStatus } from '@/types/domain';
import { frToISO, isoToFR } from '@/utils/format';

interface ClassInfo {
  classeId: string;
  classe: string;
}

function toAccountStatus(statut: StudentStatus): NonNullable<UpdateUserRequestDto['status']> {
  switch (statut) {
    case 'suspendu':
      return 'SUSPENDED';
    case 'transfere':
      return 'TRANSFERRED';
    default:
      return 'ACTIVE';
  }
}

function fromAccountStatus(status: string | undefined): StudentStatus {
  switch (status) {
    case 'SUSPENDED':
      return 'suspendu';
    case 'TRANSFERRED':
      return 'transfere';
    default:
      return 'actif';
  }
}

/**
 * `UserResponse` ne rend ni moyenne/absences/retards (aucune route ne les
 * calcule par élève — voir academic-service) ni un taux de paiement PAR
 * élève (payment-service n'expose qu'un agrégat par classe/école, voir
 * `PaymentConfigPort.getCollectionRateForStudents`). Ces quatre champs
 * restent à 0 ; `ClassDetailPage` et `StudentsTable` ne s'appuient plus sur
 * eux pour leurs propres agrégats.
 */
function fromUserResponse(dto: UserResponseDto, classInfo: ClassInfo | undefined): Student {
  return {
    id: dto.id,
    prenom: dto.firstName,
    nom: dto.lastName,
    classeId: classInfo?.classeId ?? '',
    classe: classInfo?.classe ?? '—',
    dateNaissance: dto.birthDate ? isoToFR(dto.birthDate.slice(0, 10)) : '—',
    sexe: dto.sexe === 'MASCULIN' ? 'M' : 'F',
    // CORRECTION gap connu : `CreateUserRequest.parentIds` attend des ids de
    // comptes PARENT déjà existants, pas un nom libre — l'écran de création
    // actuel (`StudentFormSheet`) saisit un nom libre qui ne correspond à
    // aucun flux backend de liaison parent. Affiché ici comme un simple
    // décompte, en attendant un écran dédié de liaison par téléphone (même
    // principe que `TeachersPort.findByPhone`).
    parent: dto.parentIds && dto.parentIds.length > 0 ? `${dto.parentIds.length} parent(s) lié(s)` : '—',
    tel: dto.phone ?? '—',
    statut: fromAccountStatus(dto.accountStatus),
    moyenne: 0,
    absences: 0,
    retards: 0,
    tauxPaiement: 0,
    photoUrl: dto.photoUrl ?? null,
  };
}

function buildStudentClassIndex(classesDtos: ClassInfoDto[]): Map<string, ClassInfo> {
  const byStudent = new Map<string, ClassInfo>();
  for (const c of classesDtos) {
    for (const studentId of c.studentIds) {
      byStudent.set(studentId, { classeId: c.id, classe: c.fullName });
    }
  }
  return byStudent;
}

async function findClassInfoForStudent(schoolId: string, studentId: string): Promise<ClassInfo | undefined> {
  const classesDtos = await fetchSchoolClasses(schoolId);
  return buildStudentClassIndex(classesDtos).get(studentId);
}

/**
 * Portage réel — `user-service` (`UserController`). `moyenne`/`absences`/
 * `retards`/`tauxPaiement` restent à 0 (voir `fromUserResponse`) : décision
 * prise avec la direction le 2026-10-15 — moyenne lue via
 * `AcademicResultsPort.getClassAverage` (academic-service) et taux de
 * paiement via `PaymentConfigPort.getCollectionRateForStudents`
 * (payment-service, nouvel endpoint bulk), les deux agrégés au niveau
 * CLASSE plutôt que par élève.
 */
export function createStudentsApi(): Pick<StudentsPort, 'list' | 'listPage' | 'get' | 'create' | 'update' | 'remove' | 'getAbsenceCounts' | 'getAttendanceMarks' | 'block' | 'unblock'> {
  return {
    async list(classId?: string): Promise<Student[]> {
      const { schoolId } = sessionContext();
      const [users, classesDtos] = await Promise.all([
        request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(schoolId)}`, {
          query: { role: 'STUDENT' },
        }),
        fetchSchoolClasses(schoolId),
      ]);
      const byStudent = buildStudentClassIndex(classesDtos);
      const all = users.map((u) => fromUserResponse(u, byStudent.get(u.id)));
      return classId ? all.filter((s) => s.classeId === classId) : all;
    },

    /**
     * Portage réel (voir le commentaire de `StudentsPort.listPage`) —
     * `user-service` (`GET /users/school/{schoolId}/page`). Les classes de
     * l'école sont résolues en parallèle pour le même motif que `list`
     * (`UserResponse` n'a pas de champ classe direct).
     */
    async listPage(input): Promise<{ items: Student[]; totalElements: number; totalPages: number }> {
      const { schoolId } = sessionContext();
      const [pageDto, classesDtos] = await Promise.all([
        request<ApiPage<UserResponseDto>>(`/api/v1/users/school/${encodeURIComponent(schoolId)}/page`, {
          query: { role: 'STUDENT', page: input.page, size: input.size, search: input.search || undefined },
        }),
        fetchSchoolClasses(schoolId),
      ]);
      const byStudent = buildStudentClassIndex(classesDtos);
      return {
        items: pageDto.content.map((u) => fromUserResponse(u, byStudent.get(u.id))),
        totalElements: pageDto.totalElements,
        totalPages: pageDto.totalPages,
      };
    },

    async get(studentId: string): Promise<Student> {
      const { schoolId } = sessionContext();
      const [dto, classInfo] = await Promise.all([
        request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(studentId)}`),
        findClassInfoForStudent(schoolId, studentId),
      ]);
      return fromUserResponse(dto, classInfo);
    },

    async create(input): Promise<Student> {
      const { schoolId } = sessionContext();
      // CORRECTION (bug signalé) : `CreateUserRequest.classId` n'est lu par
      // AUCUN code de user-service (vérifié — le champ n'existe que dans le
      // DTO) ; l'élève était donc créé SANS JAMAIS être inscrit au roster
      // réel de sa classe (`ClassGroup.studentIds`, class-service, seul
      // maître de l'inscription — voir `ClassController`). L'inscription se
      // fait maintenant explicitement via le même endpoint qu'utilise le
      // transfert interne (`POST /classes/{classId}/students/{studentId}`).
      const body: CreateUserRequestDto = {
        schoolId,
        role: 'STUDENT',
        firstName: input.prenom,
        lastName: input.nom,
        phone: input.tel,
        sexe: input.sexe === 'M' ? 'MASCULIN' : 'FEMININ',
        birthDate: frToISO(input.dateNaissance),
        status: 'ACTIVE',
      };
      const dto = await request<UserResponseDto>('/api/v1/users', { method: 'POST', body });

      // Classe optionnelle (nouvelle demande direction) — un élève créé sans
      // classe reste normalement listé (classe affichée « — ») et se la voit
      // assigner plus tard depuis sa fiche détail.
      if (!input.classeId) {
        return fromUserResponse(dto, undefined);
      }
      const [, classInfo] = await Promise.all([
        request<void>(`/api/v1/classes/${encodeURIComponent(input.classeId)}/students/${encodeURIComponent(dto.id)}`, {
          method: 'POST',
        }),
        request<{ id: string; fullName: string }>(`/api/v1/classes/${encodeURIComponent(input.classeId)}`),
      ]);
      return fromUserResponse(dto, { classeId: classInfo.id, classe: classInfo.fullName });
    },

    async update(studentId: string, patch: Partial<Student>): Promise<Student> {
      const { schoolId } = sessionContext();
      const body: UpdateUserRequestDto = {};
      if (patch.prenom !== undefined) body.firstName = patch.prenom;
      if (patch.nom !== undefined) body.lastName = patch.nom;
      if (patch.tel !== undefined) body.phone = patch.tel;
      if (patch.dateNaissance !== undefined) body.birthDate = frToISO(patch.dateNaissance);
      if (patch.statut !== undefined) body.status = toAccountStatus(patch.statut);
      // `patch.parent`, `patch.classeId`, `patch.sexe`, `patch.moyenne`… :
      // aucune contrepartie backend persistable depuis cet écran — voir le
      // commentaire de `fromUserResponse`. `StudentEditSheet` n'envoie de
      // toute façon que tel/parent/dateNaissance/statut aujourd'hui.
      const [dto, classInfo] = await Promise.all([
        request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(studentId)}`, { method: 'PUT', body }),
        findClassInfoForStudent(schoolId, studentId),
      ]);
      return fromUserResponse(dto, classInfo);
    },

    async remove(studentId: string): Promise<void> {
      const { schoolId } = sessionContext();
      await request<void>(`/api/v1/users/${encodeURIComponent(studentId)}`, {
        method: 'DELETE',
        query: { schoolId },
      });
    },

    async block(studentId: string): Promise<void> {
      const { schoolId } = sessionContext();
      await request<unknown>(`/api/v1/users/${encodeURIComponent(studentId)}/block`, {
        method: 'PATCH',
        query: { schoolId },
      });
    },

    async unblock(studentId: string): Promise<void> {
      const { schoolId } = sessionContext();
      await request<unknown>(`/api/v1/users/${encodeURIComponent(studentId)}/unblock`, {
        method: 'PATCH',
        query: { schoolId },
      });
    },

    async getAbsenceCounts(studentIds: string[]): Promise<Record<string, number>> {
      const result: Record<string, number> = {};
      if (studentIds.length === 0) return result;
      const yearId = await resolveYearId();
      const stats = await request<StudentAbsenceStatsDto>('/api/v1/attendances/analytics/students/stats', {
        query: { studentIds: studentIds.join(','), yearId },
      });
      for (const [studentId, s] of Object.entries(stats)) {
        result[studentId] = s.total;
      }
      return result;
    },

    async getAttendanceMarks(studentId: string): Promise<{ present: number; absent: number; late: number }> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      const dto = await request<Record<string, number>>(
        `/api/v1/attendances/analytics/student/${encodeURIComponent(studentId)}/marks`,
        { query: { schoolId, yearId } },
      );
      return { present: dto.present ?? 0, absent: dto.absent ?? 0, late: dto.late ?? 0 };
    },
  };
}
