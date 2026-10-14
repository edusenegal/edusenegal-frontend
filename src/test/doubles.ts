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
      listAcademicYears: notStubbed('school.listAcademicYears'),
      openAcademicYear: notStubbed('school.openAcademicYear'),
      closeAcademicYear: notStubbed('school.closeAcademicYear'),
    },
    dashboard: { getSnapshot: notStubbed('dashboard.getSnapshot') },
    classes: {
      list: notStubbed('classes.list'),
      get: notStubbed('classes.get'),
      create: notStubbed('classes.create'),
      setHomeroomTeacher: notStubbed('classes.setHomeroomTeacher'),
      listEvents: notStubbed('classes.listEvents'),
      planEvent: notStubbed('classes.planEvent'),
      getWeeklySchedule: notStubbed('classes.getWeeklySchedule'),
    },
    teachers: {
      list: notStubbed('teachers.list'),
      get: notStubbed('teachers.get'),
      create: notStubbed('teachers.create'),
      update: notStubbed('teachers.update'),
      remove: notStubbed('teachers.remove'),
      addClass: notStubbed('teachers.addClass'),
      removeClass: notStubbed('teachers.removeClass'),
      listDocuments: notStubbed('teachers.listDocuments'),
      listPayslips: notStubbed('teachers.listPayslips'),
    },
    students: {
      list: notStubbed('students.list'),
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
      requestInternal: notStubbed('transfers.requestInternal'),
      requestExternal: notStubbed('transfers.requestExternal'),
    },
    leaves: {
      list: notStubbed('leaves.list'),
      review: notStubbed('leaves.review'),
    },
    salaryRequests: {
      list: notStubbed('salaryRequests.list'),
      create: notStubbed('salaryRequests.create'),
      createBulk: notStubbed('salaryRequests.createBulk'),
    },
    signatures: {
      listDocuments: notStubbed('signatures.listDocuments'),
      listBulletinPeriods: notStubbed('signatures.listBulletinPeriods'),
      signForStudent: notStubbed('signatures.signForStudent'),
      signForStaff: notStubbed('signatures.signForStaff'),
      signBulk: notStubbed('signatures.signBulk'),
      importToSign: notStubbed('signatures.importToSign'),
    },
    notices: {
      list: notStubbed('notices.list'),
      create: notStubbed('notices.create'),
    },
  } as unknown as Services;

  return { ...base, ...overrides };
}
