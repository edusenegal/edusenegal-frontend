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
      switchSchool: notStubbed('auth.switchSchool'),
      updateMyPhoto: notStubbed('auth.updateMyPhoto'),
      updateMyEmail: notStubbed('auth.updateMyEmail'),
    },
    school: {
      getSchool: notStubbed('school.getSchool'),
      getSchoolById: notStubbed('school.getSchoolById'),
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
      updateDescription: notStubbed('timetable.updateDescription'),
    },
    grades: {
      listForClass: notStubbed('grades.listForClass'),
      enter: notStubbed('grades.enter'),
      enterBulk: notStubbed('grades.enterBulk'),
      update: notStubbed('grades.update'),
      history: notStubbed('grades.history'),
    },
    gradeDisputes: {
      listPending: notStubbed('gradeDisputes.listPending'),
      decide: notStubbed('gradeDisputes.decide'),
    },
    results: {
      getStudentSemesterResult: notStubbed('results.getStudentSemesterResult'),
      downloadBulletinPdf: notStubbed('results.downloadBulletinPdf'),
      getBulletinPdfBlob: notStubbed('results.getBulletinPdfBlob'),
    },
    attendance: {
      mark: notStubbed('attendance.mark'),
      getSheet: notStubbed('attendance.getSheet'),
      getHistory: notStubbed('attendance.getHistory'),
    },
    courseDocuments: {
      list: notStubbed('courseDocuments.list'),
      listForSlot: notStubbed('courseDocuments.listForSlot'),
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
    rooms: {
      list: notStubbed('rooms.list'),
      checkAvailability: notStubbed('rooms.checkAvailability'),
    },
    leaves: {
      mine: notStubbed('leaves.mine'),
      request: notStubbed('leaves.request'),
    },
    payslips: {
      mine: notStubbed('payslips.mine'),
      downloadPdf: notStubbed('payslips.downloadPdf'),
      pendingCashNotices: notStubbed('payslips.pendingCashNotices'),
      confirmCashReceipt: notStubbed('payslips.confirmCashReceipt'),
      rejectCashReceipt: notStubbed('payslips.rejectCashReceipt'),
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
      remove: notStubbed('notifications.remove'),
      clearAll: notStubbed('notifications.clearAll'),
    },
    complaints: {
      mine: notStubbed('complaints.mine'),
      create: notStubbed('complaints.create'),
    },
  };

  return { ...base, ...overrides };
}
