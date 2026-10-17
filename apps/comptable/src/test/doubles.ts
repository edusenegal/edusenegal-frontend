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
      currentAccountant: notStubbed('auth.currentAccountant'),
    },
    school: {
      getSchool: notStubbed('school.getSchool'),
    },
    expenses: {
      list: notStubbed('expenses.list'),
      findById: notStubbed('expenses.findById'),
      create: notStubbed('expenses.create'),
      submit: notStubbed('expenses.submit'),
      validate: notStubbed('expenses.validate'),
      cancel: notStubbed('expenses.cancel'),
      attachFile: notStubbed('expenses.attachFile'),
    },
  } as unknown as Services;

  return { ...base, ...overrides };
}
