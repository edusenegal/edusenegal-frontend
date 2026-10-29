import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import type { ApiPage, ClassInfoDto, UserResponseDto } from '@/types/api';
import type { StudentsPort } from '@/services/ports';
import type { ClassOption, StudentFullDetail, StudentParentContact, StudentPickerEntry } from '@/types/domain';
import { isoToFR } from '@/utils/format';

function buildStudentClassIndex(classesDtos: ClassInfoDto[]): Map<string, { classId: string; classe: string }> {
  const byStudent = new Map<string, { classId: string; classe: string }>();
  for (const c of classesDtos) {
    for (const studentId of c.studentIds) {
      byStudent.set(studentId, { classId: c.id, classe: c.fullName });
    }
  }
  return byStudent;
}

async function fetchAllStudents(): Promise<StudentPickerEntry[]> {
  const { schoolId } = sessionContext();
  const [users, classesDtos] = await Promise.all([
    request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(schoolId)}`, {
      query: { role: 'STUDENT' },
    }),
    fetchSchoolClasses(schoolId),
  ]);
  const byStudent = buildStudentClassIndex(classesDtos);

  return users.map((u) => {
    const info = byStudent.get(u.id);
    return {
      id: u.id,
      nom: `${u.firstName} ${u.lastName}`,
      classe: info?.classe ?? '—',
      classId: info?.classId ?? '',
    };
  });
}

/**
 * Portage minimal — `user-service` ne proposant pas de recherche
 * nom/prénom côté serveur, l'effectif élève complet de l'école est chargé
 * une fois puis filtré ici (même approche que `salaryPayments.api.ts` pour
 * le personnel enseignant). `listAll` partage le même appel — utilisé pour
 * résoudre un nom d'élève à partir d'un `studentId` dans une liste qui n'en
 * connaît que l'id (ex. `ScholarshipsPage`, vue école/par payeur) :
 * `GET /api/v1/users/{userId}` seul ne couvre pas ACCOUNTANT côté backend.
 */
export function createStudentsApi(): StudentsPort {
  return {
    async search(query: string): Promise<StudentPickerEntry[]> {
      const needle = query.trim();
      if (needle.length < 2) return [];
      const { schoolId } = sessionContext();
      // Recherche SERVEUR (paginée) — le user-service filtre désormais par
      // prénom/nom ; on ne charge plus tout l'effectif pour filtrer en local.
      const [page, classesDtos] = await Promise.all([
        request<ApiPage<UserResponseDto>>(`/api/v1/users/school/${encodeURIComponent(schoolId)}/page`, {
          query: { role: 'STUDENT', search: needle, page: 0, size: 20 },
        }),
        fetchSchoolClasses(schoolId),
      ]);
      const byStudent = buildStudentClassIndex(classesDtos);
      return page.content.map((u) => {
        const info = byStudent.get(u.id);
        return {
          id: u.id,
          nom: `${u.firstName} ${u.lastName}`,
          classe: info?.classe ?? '—',
          classId: info?.classId ?? '',
        };
      });
    },

    async listAll(): Promise<StudentPickerEntry[]> {
      return fetchAllStudents();
    },

    async listClasses(): Promise<ClassOption[]> {
      const { schoolId } = sessionContext();
      const classes = await fetchSchoolClasses(schoolId);
      return classes
        .map((c) => ({ id: c.id, name: c.fullName }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    // Fiche détaillée pour le recouvrement : identité + classe + parents.
    // `user-service` autorise désormais ACCOUNTANT sur `GET /users/{id}`
    // (même grille que le directeur), ce qui permet de résoudre chaque parent.
    async getDetail(studentId: string, classId?: string): Promise<StudentFullDetail> {
      const { schoolId } = sessionContext();
      const [student, classesDtos] = await Promise.all([
        request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(studentId)}`),
        fetchSchoolClasses(schoolId),
      ]);
      const byStudent = buildStudentClassIndex(classesDtos);
      const info = byStudent.get(studentId);

      const parentIds = student.parentIds ?? [];
      const parents: StudentParentContact[] = await Promise.all(
        parentIds.map(async (pid) => {
          try {
            const parent = await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(pid)}`);
            return {
              id: parent.id,
              prenom: parent.firstName,
              nom: parent.lastName,
              telephone: parent.phone ?? null,
            };
          } catch {
            // Un parent introuvable/supprimé ne doit pas casser la fiche.
            return { id: pid, prenom: '—', nom: '', telephone: null };
          }
        }),
      );

      return {
        id: student.id,
        prenom: student.firstName,
        nom: student.lastName,
        dateNaissance: student.birthDate ? isoToFR(student.birthDate.slice(0, 10)) : null,
        classe: info?.classe ?? '—',
        classId: classId ?? info?.classId ?? '',
        telephone: student.phone ?? null,
        parents,
      };
    },
  };
}
