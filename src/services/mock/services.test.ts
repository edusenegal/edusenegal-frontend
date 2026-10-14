import { describe, expect, it } from 'vitest';
import { createMockServices } from './index';

/**
 * Ces tests couvrent les règles métier qui ne doivent pas se dérégler au
 * fil des modifications — en particulier les deux promesses faites à la
 * direction : promouvoir une classe déplace tous ses élèves, promouvoir un
 * élève seul ne déplace que lui.
 */
describe('mock services — classes et promotions', () => {
  it('liste uniquement des classes de lycée', async () => {
    const services = createMockServices();
    const classes = await services.classes.list();
    expect(classes.length).toBeGreaterThan(0);
    for (const c of classes) {
      expect(['Seconde', 'Première', 'Terminale']).toContain(c.level);
    }
  });

  it('promoteClass déplace tous les élèves de la classe de départ', async () => {
    const services = createMockServices();
    const classes = await services.classes.list();
    const from = classes[0]!;
    const to = classes[1]!;
    const before = (await services.students.list(from.id)).length;
    expect(before).toBeGreaterThan(0);

    const result = await services.promotions.promoteClass(from.id, to.id);
    expect(result.moved).toBe(before);

    const stillInFrom = await services.students.list(from.id);
    expect(stillInFrom).toHaveLength(0);
  });

  it('promoteStudent ne déplace que l’élève choisi', async () => {
    const services = createMockServices();
    const classes = await services.classes.list();
    const from = classes[0]!;
    const to = classes[1]!;
    const roster = await services.students.list(from.id);
    const [moving, ...rest] = roster;
    expect(moving).toBeDefined();

    await services.promotions.promoteStudent(moving!.id, to.id);

    const updated = await services.students.get(moving!.id);
    expect(updated.classeId).toBe(to.id);

    const remaining = await services.students.list(from.id);
    expect(remaining.map((s) => s.id)).toEqual(rest.map((s) => s.id));
  });
});

describe('mock services — RH', () => {
  it('createBulk crée une demande de salaire par enseignant choisi', async () => {
    const services = createMockServices();
    const teachers = await services.teachers.list();
    const ids = teachers.slice(0, 3).map((t) => t.id);

    const created = await services.salaryRequests.createBulk(ids, 'Décembre 2026');
    expect(created).toHaveLength(3);
    for (const request of created) {
      expect(request.mois).toBe('Décembre 2026');
      expect(request.statut).toBe('en_attente');
    }

    const all = await services.salaryRequests.list();
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it('review met à jour le statut d’une demande de congé', async () => {
    const services = createMockServices();
    const [first] = await services.leaves.list();
    expect(first).toBeDefined();

    const approved = await services.leaves.review(first!.id, true);
    expect(approved.statut).toBe('approuve');
  });
});

describe('mock services — enseignants', () => {
  it('addClass puis removeClass laissent la liste de classes inchangée', async () => {
    const services = createMockServices();
    const teachers = await services.teachers.list();
    // Un enseignant qui n'a pas encore "Seconde A", pour ne pas ambiguïser
    // l'assertion finale avec un doublon déjà présent dans les fixtures.
    const teacher = teachers.find((t) => !t.classes.includes('Seconde A'));
    expect(teacher).toBeDefined();
    const before = [...teacher!.classes];

    await services.teachers.addClass(teacher!.id, 'Seconde A');
    const after = await services.teachers.get(teacher!.id);
    expect(after.classes).toContain('Seconde A');

    await services.teachers.removeClass(teacher!.id, 'Seconde A');
    const restored = await services.teachers.get(teacher!.id);
    expect(restored.classes).toEqual(before);
  });
});
