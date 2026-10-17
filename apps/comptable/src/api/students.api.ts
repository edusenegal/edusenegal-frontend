import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import type { ClassInfoDto, UserResponseDto } from '@/types/api';
import type { StudentsPort } from '@/services/ports';
import type { StudentPickerEntry } from '@/types/domain';

function buildStudentClassIndex(classesDtos: ClassInfoDto[]): Map<string, string> {
  const byStudent = new Map<string, string>();
  for (const c of classesDtos) {
    for (const studentId of c.studentIds) {
      byStudent.set(studentId, c.fullName);
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

  return users.map((u) => ({
    id: u.id,
    nom: `${u.firstName} ${u.lastName}`,
    classe: byStudent.get(u.id) ?? '—',
  }));
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
      const needle = query.trim().toLowerCase();
      if (needle.length < 2) return [];

      const all = await fetchAllStudents();
      return all.filter((s) => s.nom.toLowerCase().includes(needle)).slice(0, 20);
    },

    async listAll(): Promise<StudentPickerEntry[]> {
      return fetchAllStudents();
    },
  };
}
