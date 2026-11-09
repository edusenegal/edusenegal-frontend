import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import { createStudentsApi } from '@/api/students.api';
import { createSubjectsApi } from '@/api/subjects.api';
import { createTeachersApi } from '@/api/teachers.api';
import type {
  AbsenceRequestDto,
  AttendanceSessionDetailResponseDto,
  AttendanceSessionResponseDto,
  AttendanceSheetResponseDto,
  AttendanceStatsResponseDto,
  AttendanceTrendPointResponseDto,
  ClassAttendanceStatsResponseDto,
  StudentAttendanceDetailDto,
  UserResponseDto,
} from '@/types/api';
import type { StudentAttendancePort } from '@/services/ports';
import type {
  AbsenceRequestSummary,
  AbsenceReviewStatus,
  AbsentStudentEntry,
  AttendanceSession,
  AttendanceSessionDetail,
  AttendanceSessionStudent,
  AttendanceTrendGranularity,
  AttendanceTrendPoint,
  ClassAttendanceRate,
  SchoolAttendanceOverview,
} from '@/types/domain';
import { downloadBlob, isoToFR } from '@/utils/format';

/**
 * Jour de la séance (#426) — `AttendanceRecord.dayOfWeek` : le commentaire
 * du domaine backend indique un jour en français ("LUNDI"...), mais le code
 * réel (`String.valueOf(java.time.DayOfWeek)`) produit l'anglais
 * ("MONDAY"...) ; cette table couvre les deux pour ne jamais afficher une
 * valeur brute inattendue si l'un ou l'autre change.
 */
const DAY_LABEL_FR: Record<string, string> = {
  MONDAY: 'Lundi',
  TUESDAY: 'Mardi',
  WEDNESDAY: 'Mercredi',
  THURSDAY: 'Jeudi',
  FRIDAY: 'Vendredi',
  SATURDAY: 'Samedi',
  SUNDAY: 'Dimanche',
  LUNDI: 'Lundi',
  MARDI: 'Mardi',
  MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi',
  VENDREDI: 'Vendredi',
  SAMEDI: 'Samedi',
  DIMANCHE: 'Dimanche',
};
function dayLabel(raw: string): string {
  return DAY_LABEL_FR[raw.toUpperCase()] ?? raw;
}

function toAttendanceSession(
  dto: AttendanceSessionResponseDto,
  classNameById: Map<string, string>,
  subjectNameById: Map<string, string>,
  teacherNameById: Map<string, string>,
): AttendanceSession {
  return {
    id: dto.id,
    classId: dto.classId,
    className: classNameById.get(dto.classId) ?? dto.classId,
    subjectId: dto.subjectId,
    matiere: dto.subjectId ? subjectNameById.get(dto.subjectId) ?? dto.subjectId : null,
    teacherId: dto.teacherId,
    professeur: dto.teacherId ? teacherNameById.get(dto.teacherId) ?? dto.teacherId : null,
    date: isoToFR(dto.date),
    dayOfWeek: dayLabel(dto.dayOfWeek),
    period: dto.period,
    totalStudents: dto.totalStudents,
    present: dto.present,
    absent: dto.absent,
    late: dto.late,
    attendanceRate: dto.attendanceRate,
  };
}

function toAttendanceTrendPoint(dto: AttendanceTrendPointResponseDto): AttendanceTrendPoint {
  return {
    periodStart: dto.periodStart,
    periodLabel: dto.periodLabel,
    totalStudents: dto.totalStudents,
    present: dto.present,
    absent: dto.absent,
    late: dto.late,
    attendanceRate: dto.attendanceRate,
  };
}

function toSessionStudent(dto: StudentAttendanceDetailDto, nameById: Map<string, string>): AttendanceSessionStudent {
  return {
    studentId: dto.studentId,
    studentNom: nameById.get(dto.studentId) ?? dto.studentId,
    status: dto.status,
    note: dto.note,
    absenceRequestId: dto.absenceRequestId,
    absenceStatus: dto.absenceStatus,
    absenceReason: dto.absenceReason,
    hasJustification: dto.hasJustification,
  };
}

/**
 * Résout noms de classe/matière/professeur/élèves pour le détail d'une
 * séance (#1, censeur) — comme le reste de cet écran, le backend ne renvoie
 * que des ids ; factorisé ici car `getSessionDetail` et `updateStudentStatus`
 * renvoient tous les deux ce même détail enrichi.
 */
async function toSessionDetail(dto: AttendanceSessionDetailResponseDto): Promise<AttendanceSessionDetail> {
  const { schoolId } = sessionContext();
  const [classesDtos, subjects, teachers, students] = await Promise.all([
    fetchSchoolClasses(schoolId),
    createSubjectsApi().list(),
    createTeachersApi().list(),
    createStudentsApi().list(dto.classId),
  ]);
  const classNameById = new Map(classesDtos.map((c) => [c.id, c.fullName]));
  const subjectNameById = new Map(subjects.map((s) => [s.id, s.nom]));
  const teacherNameById = new Map(teachers.map((t) => [t.id, t.nom]));
  const studentNameById = new Map(students.map((s) => [s.id, `${s.prenom} ${s.nom}`]));
  const staffById = await resolveStaffNames([dto.lockedBy]);

  return {
    id: dto.id,
    classId: dto.classId,
    className: classNameById.get(dto.classId) ?? dto.classId,
    subjectId: dto.subjectId,
    matiere: dto.subjectId ? subjectNameById.get(dto.subjectId) ?? dto.subjectId : null,
    teacherId: dto.teacherId,
    professeur: dto.teacherId ? teacherNameById.get(dto.teacherId) ?? dto.teacherId : null,
    date: isoToFR(dto.date),
    dayOfWeek: dayLabel(dto.dayOfWeek),
    period: dto.period,
    totalStudents: dto.totalStudents,
    present: dto.present,
    absent: dto.absent,
    late: dto.late,
    attendanceRate: dto.attendanceRate,
    locked: dto.locked,
    lockedByNom: dto.lockedBy ? staffById.get(dto.lockedBy) ?? dto.lockedBy : null,
    lockedAt: dto.lockedAt,
    students: dto.students.map((s) => toSessionStudent(s, studentNameById)),
  };
}

/** Extension plausible à partir du content-type MinIO — jamais bloquant si inconnu. */
function extensionFor(contentType: string): string {
  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  return 'bin';
}

function fromAbsenceDto(
  dto: AbsenceRequestDto,
  nameById: Map<string, string>,
  staffById?: Map<string, string>,
): AbsenceRequestSummary {
  return {
    id: dto.id,
    studentId: dto.studentId,
    studentNom: nameById.get(dto.studentId) ?? dto.studentId,
    schoolId: dto.schoolId,
    dateFrom: isoToFR(dto.absenceDateFrom),
    dateTo: isoToFR(dto.absenceDateTo),
    reason: dto.reason,
    hasJustification: dto.justificationUrl !== null,
    status: dto.status,
    reviewedBy: dto.reviewedBy,
    reviewedByNom: dto.reviewedBy ? (staffById?.get(dto.reviewedBy) ?? null) : null,
    reviewedAt: dto.reviewedAt,
  };
}

/**
 * Résout « Prénom Nom » d'un ensemble d'ids de personnel (traiteurs d'absence)
 * via `GET /users/{id}` — accessible au censeur/surveillant. Ids dédoublonnés
 * pour limiter les appels ; un id introuvable est simplement ignoré.
 */
async function resolveStaffNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const u = await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(id)}`);
        map.set(id, `${u.firstName} ${u.lastName}`);
      } catch {
        /* id introuvable — on laisse l'id brut en repli */
      }
    }),
  );
  return map;
}

/**
 * Portage réel (items #400/#402) — attendance-service, via l'api-gateway.
 *
 * `getClassesStats`/`getAbsentStudents` résolvent les noms de classe/élève
 * côté client : le backend ne renvoie que des `classId`/`studentId` (aucun
 * service n'agrège "nom + taux" en un seul appel).
 */
export function createStudentAttendanceApi(): StudentAttendancePort {
  return {
    async getSchoolStats(from, to): Promise<SchoolAttendanceOverview> {
      const { schoolId } = sessionContext();
      const dto = await request<AttendanceStatsResponseDto>('/api/v1/attendances/analytics/school/stats', {
        query: { schoolId, from, to },
      });
      return {
        from: dto.from,
        to: dto.to,
        totalRecords: dto.totalRecords,
        present: dto.totalPresent,
        absent: dto.totalAbsent,
        late: dto.totalLate,
        attendanceRate: dto.attendanceRate,
      };
    },

    async getClassesStats(from, to): Promise<ClassAttendanceRate[]> {
      const { schoolId } = sessionContext();
      const [rows, classesDtos] = await Promise.all([
        request<ClassAttendanceStatsResponseDto[]>('/api/v1/attendances/analytics/school/classes-stats', {
          query: { schoolId, from, to },
        }),
        fetchSchoolClasses(schoolId),
      ]);
      const nameById = new Map(classesDtos.map((c) => [c.id, c.fullName]));
      return rows.map((r) => ({
        classId: r.classId,
        className: nameById.get(r.classId) ?? r.classId,
        totalStudents: r.totalStudents,
        present: r.present,
        absent: r.absent,
        late: r.late,
        attendanceRate: r.attendanceRate,
      }));
    },

    async getAbsentStudents(classId, from, to): Promise<AbsentStudentEntry[]> {
      const { schoolId } = sessionContext();
      // On croise DEUX sources d'absents, toutes deux scopées à la plage :
      //  1. la feuille d'appel (AttendanceRecord) — fiable quand le prof a fait
      //     l'appel pour CE jour ET cette classe ;
      //  2. les demandes d'absence (AbsenceRequest) — créées automatiquement
      //     dès qu'un élève est marqué ABSENT, visibles dans « à traiter ».
      // Sans (2), un élève bien marqué absent n'apparaissait pas ici dès que
      // la feuille du jour n'était pas (ou plus) retrouvée par date exacte,
      // alors qu'il figurait dans « Demandes à traiter » — l'incohérence
      // signalée. L'union (dédoublonnée par élève) rend les deux vues
      // cohérentes.
      const [sheet, students, absences] = await Promise.all([
        request<AttendanceSheetResponseDto>('/api/v1/attendances/analytics/class/sheet/range', {
          query: { schoolId, classId, from, to },
        }),
        createStudentsApi().list(classId),
        request<AbsenceRequestDto[]>(`/api/v1/attendances/absence/school/${encodeURIComponent(schoolId)}`),
      ]);
      const nameById = new Map(students.map((s) => [s.id, `${s.prenom} ${s.nom}`]));
      const roster = new Set(students.map((s) => s.id));

      const rows: AbsentStudentEntry[] = sheet.students
        .filter((s) => s.status === 'ABSENT' || s.status === 'LATE')
        .map((s) => ({
          studentId: s.studentId,
          studentNom: nameById.get(s.studentId) ?? s.studentId,
          status: s.status,
          note: s.note,
        }));

      const seen = new Set(rows.map((r) => r.studentId));
      for (const a of absences) {
        if (!roster.has(a.studentId) || seen.has(a.studentId)) continue;
        // Chevauchement avec la plage demandée (ISO yyyy-mm-dd comparable).
        if (a.absenceDateFrom > to || a.absenceDateTo < from) continue;
        rows.push({
          studentId: a.studentId,
          studentNom: nameById.get(a.studentId) ?? a.studentId,
          status: 'ABSENT',
          note: a.reason ?? null,
        });
        seen.add(a.studentId);
      }
      return rows;
    },

    async listSchoolAbsences(status?: AbsenceReviewStatus): Promise<AbsenceRequestSummary[]> {
      const { schoolId } = sessionContext();
      const [dtos, students] = await Promise.all([
        request<AbsenceRequestDto[]>(`/api/v1/attendances/absence/school/${encodeURIComponent(schoolId)}`, {
          query: status ? { status } : undefined,
        }),
        createStudentsApi().list(),
      ]);
      const nameById = new Map(students.map((s) => [s.id, `${s.prenom} ${s.nom}`]));
      const staffById = await resolveStaffNames(dtos.map((d) => d.reviewedBy));
      return dtos
        .map((dto) => fromAbsenceDto(dto, nameById, staffById))
        .sort((a, b) => b.dateFrom.localeCompare(a.dateFrom));
    },

    async reviewAbsence(absenceId, status): Promise<AbsenceRequestSummary> {
      const dto = await request<AbsenceRequestDto>(
        `/api/v1/attendances/absence/${encodeURIComponent(absenceId)}/review`,
        { method: 'PUT', query: { status } },
      );
      const students = await createStudentsApi().list();
      const nameById = new Map(students.map((s) => [s.id, `${s.prenom} ${s.nom}`]));
      const staffById = await resolveStaffNames([dto.reviewedBy]);
      return fromAbsenceDto(dto, nameById, staffById);
    },

    async getSchoolSessions(from, to): Promise<AttendanceSession[]> {
      const { schoolId } = sessionContext();
      const [rows, classesDtos, subjects, teachers] = await Promise.all([
        request<AttendanceSessionResponseDto[]>('/api/v1/attendances/analytics/school/sessions', {
          query: { schoolId, from, to },
        }),
        fetchSchoolClasses(schoolId),
        createSubjectsApi().list(),
        createTeachersApi().list(),
      ]);
      const classNameById = new Map(classesDtos.map((c) => [c.id, c.fullName]));
      const subjectNameById = new Map(subjects.map((s) => [s.id, s.nom]));
      const teacherNameById = new Map(teachers.map((t) => [t.id, t.nom]));
      return rows.map((r) => toAttendanceSession(r, classNameById, subjectNameById, teacherNameById));
    },

    async getClassSessions(classId, from, to): Promise<AttendanceSession[]> {
      const { schoolId } = sessionContext();
      const [rows, classesDtos, subjects, teachers] = await Promise.all([
        request<AttendanceSessionResponseDto[]>(`/api/v1/attendances/analytics/class/${encodeURIComponent(classId)}/sessions`, {
          query: { schoolId, from, to },
        }),
        fetchSchoolClasses(schoolId),
        createSubjectsApi().list(),
        createTeachersApi().list(),
      ]);
      const classNameById = new Map(classesDtos.map((c) => [c.id, c.fullName]));
      const subjectNameById = new Map(subjects.map((s) => [s.id, s.nom]));
      const teacherNameById = new Map(teachers.map((t) => [t.id, t.nom]));
      return rows.map((r) => toAttendanceSession(r, classNameById, subjectNameById, teacherNameById));
    },

    async getSchoolTrend(from, to, granularity: AttendanceTrendGranularity): Promise<AttendanceTrendPoint[]> {
      const { schoolId } = sessionContext();
      const rows = await request<AttendanceTrendPointResponseDto[]>('/api/v1/attendances/analytics/school/trend', {
        query: { schoolId, from, to, granularity },
      });
      return rows.map(toAttendanceTrendPoint);
    },

    async getClassTrend(classId, from, to, granularity: AttendanceTrendGranularity): Promise<AttendanceTrendPoint[]> {
      const { schoolId } = sessionContext();
      const rows = await request<AttendanceTrendPointResponseDto[]>(
        `/api/v1/attendances/analytics/class/${encodeURIComponent(classId)}/trend`,
        { query: { schoolId, from, to, granularity } },
      );
      return rows.map(toAttendanceTrendPoint);
    },

    async getSessionDetail(sessionId): Promise<AttendanceSessionDetail> {
      const { schoolId } = sessionContext();
      const dto = await request<AttendanceSessionDetailResponseDto>(
        `/api/v1/attendances/analytics/session/${encodeURIComponent(sessionId)}`,
        { query: { schoolId } },
      );
      return toSessionDetail(dto);
    },

    async lockSession(sessionId): Promise<AttendanceSessionDetail> {
      const { schoolId } = sessionContext();
      const dto = await request<AttendanceSessionDetailResponseDto>(
        `/api/v1/attendances/analytics/session/${encodeURIComponent(sessionId)}/lock`,
        { method: 'PUT', query: { schoolId } },
      );
      return toSessionDetail(dto);
    },

    async unlockSession(sessionId): Promise<AttendanceSessionDetail> {
      const { schoolId } = sessionContext();
      const dto = await request<AttendanceSessionDetailResponseDto>(
        `/api/v1/attendances/analytics/session/${encodeURIComponent(sessionId)}/unlock`,
        { method: 'PUT', query: { schoolId } },
      );
      return toSessionDetail(dto);
    },

    async updateStudentStatus(sessionId, studentId, status, note): Promise<AttendanceSessionDetail> {
      const { schoolId } = sessionContext();
      const dto = await request<AttendanceSessionDetailResponseDto>(
        `/api/v1/attendances/analytics/session/${encodeURIComponent(sessionId)}/students/${encodeURIComponent(studentId)}`,
        { method: 'PUT', query: { schoolId }, body: { status, note: note ?? null } },
      );
      return toSessionDetail(dto);
    },

    async downloadJustification(absenceRequestId, studentNom): Promise<void> {
      const blob = await request<Blob>(
        `/api/v1/attendances/absence/${encodeURIComponent(absenceRequestId)}/justification/download`,
        { responseType: 'blob' },
      );
      const safeName = studentNom.trim().replace(/\s+/g, '_').toLowerCase() || 'eleve';
      downloadBlob(blob, `justificatif_${safeName}_${absenceRequestId.slice(0, 8)}.${extensionFor(blob.type)}`);
    },
  };
}
