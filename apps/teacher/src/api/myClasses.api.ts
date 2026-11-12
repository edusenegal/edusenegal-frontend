import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import type { ClassInfoDto, TimetableSlotResponseDto, UserResponseDto } from '@/types/api';
import type { ApiSchoolType } from '@/types/api';
import type { MyClassesPort } from '@/services/ports';
import type { MyClass, StudentRosterEntry } from '@/types/domain';

/**
 * "Mes classes" — `UserResponse` n'expose pas de `classIds` pour un
 * enseignant (seulement `subjectIds`, voir `auth.api.ts`) : on résout
 * l'appartenance en filtrant `ClassInfoDto.teacherIds` côté frontend, comme
 * `apps/director` le fait déjà pour les élèves (`fetchSchoolClasses` +
 * filtre, voir son `students.api.ts`).
 *
 * CORRECTION (signalé) — `teacherIds` (= principal + itinérants, voir
 * `ClassServiceImpl#collectTeachers` côté backend) est une liste à part,
 * gérée depuis l'écran "Classes" de la direction -- distincte de l'emploi
 * du temps. Un enseignant qui a un créneau sur une classe (donc un cours
 * RÉEL, visible dans son "Mon emploi du temps") sans y avoir aussi été
 * ajouté comme itinérant n'apparaissait dans AUCUNE classe ici : "Appel" et
 * "Notes" (les deux consomment `myClasses.list()`/`roster()`) n'avaient
 * alors rien à proposer dans le sélecteur de classe, donc jamais de liste
 * d'élèves à afficher -- pas une erreur réseau, juste une classe absente de
 * cette liste. On ajoute donc aussi les classes où une entrée de
 * `GET /timetables/teacher/{teacherId}` existe, même sans entrée dans
 * `teacherIds`.
 */
function dedupeClassIds(classIds: Iterable<string>): string[] {
  return Array.from(new Set(classIds));
}

const CYCLE_OF: Record<ApiSchoolType, 'preschool' | 'primary' | 'college' | 'lycee' | 'university'> = {
  PRESCHOOL: 'preschool', PRIMARY: 'primary', COLLEGE: 'college', LYCEE: 'lycee', UNIVERSITY: 'university',
};

export function createMyClassesApi(): MyClassesPort {
  return {
    async list(): Promise<MyClass[]> {
      const { schoolId, userId } = sessionContext();
      const [classes, slots] = await Promise.all([
        fetchSchoolClasses(schoolId),
        request<TimetableSlotResponseDto[]>(`/api/v1/timetables/teacher/${encodeURIComponent(userId)}`, {
          query: { schoolId },
        }),
      ]);
      const classById = new Map<string, ClassInfoDto>(classes.map((c) => [c.id, c]));
      const fromTeacherIds = classes.filter((c) => c.teacherIds.includes(userId)).map((c) => c.id);
      const fromTimetable = slots.map((s) => s.classId).filter((id): id is string => Boolean(id) && classById.has(id));
      return dedupeClassIds([...fromTeacherIds, ...fromTimetable])
        .map((id) => classById.get(id))
        .filter((c): c is ClassInfoDto => c !== undefined)
        .map((c) => ({
          id: c.id,
          nom: c.fullName,
          level: c.level,
          series: c.series,
          effectif: c.studentIds.length,
          estPrincipal: c.homeroomTeacherId === userId,
          schoolType: c.schoolType ? CYCLE_OF[c.schoolType] : undefined,
        }));
    },

    /**
     * Roster d'une classe.
     *
     * CORRECTION (signalé) — on lisait `GET /users/class/{classId}/students`
     * (user-service), qui filtre sur `User.schoolProfiles[].classIds`. Ce
     * champ n'est en réalité JAMAIS renseigné : `ClassServiceImpl#enrollStudent`
     * / `unenrollStudent` (class-service) ne modifient que `SchoolClass.studentIds`
     * et publient un événement Kafka ("class.student.enrolled") que
     * user-service ne consomme nulle part (aucun `@KafkaListener` dessus) —
     * donc la liste des élèves d'une classe était systématiquement vide ici
     * (Appel, Saisie des notes, Résultats, Mes classes, litiges de notes),
     * même quand la classe et son effectif s'affichaient correctement
     * (ceux-ci viennent de `ClassInfo.studentIds`, côté class-service, qui
     * lui est bien à jour).
     *
     * On lit donc directement `GET /classes/{classId}/students` (class-service),
     * la même source que l'effectif déjà utilisé dans `list()` ci-dessus — pas
     * de restriction de rôle sur cette route côté backend (voir
     * `ClassController#getStudentIds`). Chaque id est ensuite résolu en nom
     * via `GET /users/{id}`, route elle aussi ouverte au rôle enseignant sans
     * restriction supplémentaire (voir `UserController#getUser`). Pas de
     * route "bulk" côté backend à ce jour.
     *
     * Un correctif backend (consumer Kafka dans user-service tenant
     * `schoolProfiles[].classIds` à jour) est traité séparément pour que les
     * deux sources de vérité ne divergent plus — ce fix frontend reste
     * nécessaire/correct même une fois ce consumer ajouté, puisque
     * class-service est la source canonique de l'inscription.
     */
    async roster(classId: string): Promise<StudentRosterEntry[]> {
      const studentIds = await request<string[]>(`/api/v1/classes/${encodeURIComponent(classId)}/students`);
      const students = await Promise.all(
        studentIds.map((id) => request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(id)}`)),
      );
      return students
        .map((s) => ({ id: s.id, prenom: s.firstName, nom: s.lastName }))
        .sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    },
  };
}
