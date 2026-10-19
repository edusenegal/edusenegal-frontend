import { createAttendanceApi } from '@/api/attendance.api';
import { createAuthApi } from '@/api/auth.api';
import { createComplaintsApi } from '@/api/complaints.api';
import { createCourseDocumentsApi } from '@/api/courseDocuments.api';
import { createExamsApi } from '@/api/exams.api';
import { createGradeDisputesApi } from '@/api/gradeDisputes.api';
import { createGradesApi } from '@/api/grades.api';
import { createLeavesApi } from '@/api/leaves.api';
import { createMessagingApi } from '@/api/messaging.api';
import { createMyClassesApi } from '@/api/myClasses.api';
import { createNotificationsApi } from '@/api/notifications.api';
import { createPayslipsApi } from '@/api/payslips.api';
import { createPersonalDocumentsApi } from '@/api/personalDocuments.api';
import { createQuizApi } from '@/api/quiz.api';
import { createResultsApi } from '@/api/results.api';
import { createRoomsApi } from '@/api/rooms.api';
import { createSchoolApi } from '@/api/school.api';
import { createSubjectsApi } from '@/api/subjects.api';
import { createTimetableApi } from '@/api/timetable.api';
import type { Services } from '@/services/ports';

/** Assemblage des services HTTP — espace enseignant. Tous les ports sont réels, voir le README. */
export function createApiServices(): Services {
  return {
    auth: createAuthApi(),
    school: createSchoolApi(),
    subjects: createSubjectsApi(),
    myClasses: createMyClassesApi(),
    timetable: createTimetableApi(),
    grades: createGradesApi(),
    gradeDisputes: createGradeDisputesApi(),
    results: createResultsApi(),
    attendance: createAttendanceApi(),
    courseDocuments: createCourseDocumentsApi(),
    personalDocuments: createPersonalDocumentsApi(),
    exams: createExamsApi(),
    rooms: createRoomsApi(),
    leaves: createLeavesApi(),
    payslips: createPayslipsApi(),
    quiz: createQuizApi(),
    messaging: createMessagingApi(),
    notifications: createNotificationsApi(),
    complaints: createComplaintsApi(),
  };
}
