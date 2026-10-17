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
      currentDirector: notStubbed('auth.currentDirector'),
    },
    school: {
      getSchool: notStubbed('school.getSchool'),
      updateBranding: notStubbed('school.updateBranding'),
      uploadLogo: notStubbed('school.uploadLogo'),
      updateContactInfo: notStubbed('school.updateContactInfo'),
      listAcademicYears: notStubbed('school.listAcademicYears'),
      openAcademicYear: notStubbed('school.openAcademicYear'),
      closeAcademicYear: notStubbed('school.closeAcademicYear'),
    },
    dashboard: { getSnapshot: notStubbed('dashboard.getSnapshot') },
    bilanAnnuel: { getBilan: notStubbed('bilanAnnuel.getBilan') },
    classes: {
      list: notStubbed('classes.list'),
      get: notStubbed('classes.get'),
      create: notStubbed('classes.create'),
      setHomeroomTeacher: notStubbed('classes.setHomeroomTeacher'),
      setDefaultRoom: notStubbed('classes.setDefaultRoom'),
      listEvents: notStubbed('classes.listEvents'),
      planEvent: notStubbed('classes.planEvent'),
      getWeeklySchedule: notStubbed('classes.getWeeklySchedule'),
      enroll: notStubbed('classes.enroll'),
      unenroll: notStubbed('classes.unenroll'),
    },
    teachers: {
      list: notStubbed('teachers.list'),
      get: notStubbed('teachers.get'),
      create: notStubbed('teachers.create'),
      findByPhone: notStubbed('teachers.findByPhone'),
      attachExisting: notStubbed('teachers.attachExisting'),
      update: notStubbed('teachers.update'),
      remove: notStubbed('teachers.remove'),
      addClass: notStubbed('teachers.addClass'),
      removeClass: notStubbed('teachers.removeClass'),
      listDocuments: notStubbed('teachers.listDocuments'),
      listPayslips: notStubbed('teachers.listPayslips'),
      updateSalary: notStubbed('teachers.updateSalary'),
    },
    students: {
      list: notStubbed('students.list'),
      listPage: notStubbed('students.listPage'),
      get: notStubbed('students.get'),
      create: notStubbed('students.create'),
      update: notStubbed('students.update'),
      remove: notStubbed('students.remove'),
    },
    subjects: {
      list: notStubbed('subjects.list'),
      get: notStubbed('subjects.get'),
      create: notStubbed('subjects.create'),
      setCoefficients: notStubbed('subjects.setCoefficients'),
      remove: notStubbed('subjects.remove'),
    },
    paymentConfig: {
      get: notStubbed('paymentConfig.get'),
      save: notStubbed('paymentConfig.save'),
    },
    promotions: {
      promoteClass: notStubbed('promotions.promoteClass'),
      promoteStudent: notStubbed('promotions.promoteStudent'),
    },
    transfers: {
      list: notStubbed('transfers.list'),
      get: notStubbed('transfers.get'),
      requestExternal: notStubbed('transfers.requestExternal'),
      previewInternal: notStubbed('transfers.previewInternal'),
      executeInternal: notStubbed('transfers.executeInternal'),
    },
    rooms: {
      list: notStubbed('rooms.list'),
      create: notStubbed('rooms.create'),
      update: notStubbed('rooms.update'),
      remove: notStubbed('rooms.remove'),
      checkAvailability: notStubbed('rooms.checkAvailability'),
    },
    leaves: {
      list: notStubbed('leaves.list'),
      review: notStubbed('leaves.review'),
    },
    staffAbsences: {
      list: notStubbed('staffAbsences.list'),
      record: notStubbed('staffAbsences.record'),
      remove: notStubbed('staffAbsences.remove'),
      getSummary: notStubbed('staffAbsences.getSummary'),
    },
    salaryRequests: {
      list: notStubbed('salaryRequests.list'),
      create: notStubbed('salaryRequests.create'),
      submit: notStubbed('salaryRequests.submit'),
      cancel: notStubbed('salaryRequests.cancel'),
    },
    expenses: {
      list: notStubbed('expenses.list'),
      listPage: notStubbed('expenses.listPage'),
      create: notStubbed('expenses.create'),
      attachFile: notStubbed('expenses.attachFile'),
    },
    signatures: {
      listDocuments: notStubbed('signatures.listDocuments'),
      listBulletinPeriods: notStubbed('signatures.listBulletinPeriods'),
      signForStudent: notStubbed('signatures.signForStudent'),
      signForStaff: notStubbed('signatures.signForStaff'),
      signBulk: notStubbed('signatures.signBulk'),
      importToSign: notStubbed('signatures.importToSign'),
      getMyAssets: notStubbed('signatures.getMyAssets'),
      updateMyAssets: notStubbed('signatures.updateMyAssets'),
    },
    notices: {
      list: notStubbed('notices.list'),
      create: notStubbed('notices.create'),
    },
    personalDocuments: {
      list: notStubbed('personalDocuments.list'),
      upload: notStubbed('personalDocuments.upload'),
      remove: notStubbed('personalDocuments.remove'),
    },
    courseDocuments: {
      list: notStubbed('courseDocuments.list'),
      upload: notStubbed('courseDocuments.upload'),
      remove: notStubbed('courseDocuments.remove'),
    },
  } as unknown as Services;

  return { ...base, ...overrides };
}
