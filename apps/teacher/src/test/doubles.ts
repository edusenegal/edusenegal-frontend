import { vi } from 'vitest';
import type { Services } from '@/services/ports';

/**
 * Doubles de test.
 *
 * Chaque méthode non explicitement fournie par le test échoue, pour qu'un
 * appel de service oublié se voie immédiatement au lieu de renvoyer
 * `undefined`.
 */
function notStubbed(name: string) {
  return vi.fn(() => {
    throw new Error(`Le test doit fournir un double pour ${name}.`);
  });
}

export function createServiceDoubles(overrides: Partial<Services> = {}): Services {
  const base: Services = {
    auth: {
      login: notStubbed('auth.login'),
      logout: notStubbed('auth.logout'),
      currentTeacher: notStubbed('auth.currentTeacher'),
      changePassword: notStubbed('auth.changePassword'),
    },
    school: {
      getSchool: notStubbed('school.getSchool'),
    },
    subjects: {
      listMine: notStubbed('subjects.listMine'),
    },
    myClasses: {
      list: notStubbed('myClasses.list'),
      roster: notStubbed('myClasses.roster'),
    },
    timetable: {
      mine: notStubbed('timetable.mine'),
    },
    grades: {
      listForClass: notStubbed('grades.listForClass'),
      enter: notStubbed('grades.enter'),
      enterBulk: notStubbed('grades.enterBulk'),
      update: notStubbed('grades.update'),
    },
    gradeDisputes: {
      listPending: notStubbed('gradeDisputes.listPending'),
      decide: notStubbed('gradeDisputes.decide'),
    },
    results: {
      getStudentSemesterResult: notStubbed('results.getStudentSemesterResult'),
      downloadBulletinPdf: notStubbed('results.downloadBulletinPdf'),
    },
    attendance: {
      mark: notStubbed('attendance.mark'),
      getSheet: notStubbed('attendance.getSheet'),
    },
    courseDocuments: {
      list: notStubbed('courseDocuments.list'),
      upload: notStubbed('courseDocuments.upload'),
      remove: notStubbed('courseDocuments.remove'),
    },
    personalDocuments: {
      list: notStubbed('personalDocuments.list'),
      upload: notStubbed('personalDocuments.upload'),
      remove: notStubbed('personalDocuments.remove'),
    },
    exams: {
      listForClass: notStubbed('exams.listForClass'),
      schedule: notStubbed('exams.schedule'),
      remove: notStubbed('exams.remove'),
    },
    leaves: {
      mine: notStubbed('leaves.mine'),
      request: notStubbed('leaves.request'),
    },
    payslips: {
      mine: notStubbed('payslips.mine'),
    },
    quiz: {
      mine: notStubbed('quiz.mine'),
      generate: notStubbed('quiz.generate'),
      publish: notStubbed('quiz.publish'),
      unpublish: notStubbed('quiz.unpublish'),
      remove: notStubbed('quiz.remove'),
    },
    messaging: {
      myGroups: notStubbed('messaging.myGroups'),
      messages: notStubbed('messaging.messages'),
      send: notStubbed('messaging.send'),
      markRead: notStubbed('messaging.markRead'),
    },
    notifications: {
      mine: notStubbed('notifications.mine'),
      unreadCount: notStubbed('notifications.unreadCount'),
      markRead: notStubbed('notifications.markRead'),
      markAllRead: notStubbed('notifications.markAllRead'),
    },
    complaints: {
      mine: notStubbed('complaints.mine'),
      create: notStubbed('complaints.create'),
    },
  };

  return { ...base, ...overrides };
}
