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
  it('create calcule chaque ligne selon le mode de salaire, puis submit/validate règlent le paiement (bulletin généré)', async () => {
    const services = createMockServices();
    const teachers = await services.teachers.list();
    const fixe = teachers.find((t) => t.salaryMode === 'fixe')!;
    const parJour = teachers.find((t) => t.salaryMode === 'par_jour')!;
    expect(fixe).toBeDefined();
    expect(parJour).toBeDefined();

    const created = await services.salaryRequests.create({
      periode: 'Décembre 2026',
      dateDebut: '01/12/2026',
      dateFin: '31/12/2026',
      lignes: [{ teacherId: fixe.id }, { teacherId: parJour.id, joursTravailles: 22 }],
    });
    expect(created.statut).toBe('brouillon');
    expect(created.lignes).toHaveLength(2);

    const fixeLigne = created.lignes.find((l) => l.teacherId === fixe.id)!;
    expect(fixeLigne.montantCalcule).toBe(fixe.salaireFixe);
    expect(fixeLigne.payslipId).toBeNull();

    const submitted = await services.salaryRequests.submit(created.id);
    expect(submitted.statut).toBe('en_attente');
    await expect(services.salaryRequests.submit(created.id)).rejects.toThrow();

    const validated = await services.salaryRequests.validate(created.id, true);
    expect(validated.statut).toBe('validee');
    const validatedFixeLigne = validated.lignes.find((l) => l.teacherId === fixe.id)!;
    expect(validatedFixeLigne.payslipId).toBeTruthy();

    const payslips = await services.teachers.listPayslips(fixe.id);
    expect(payslips.some((p) => p.id === validatedFixeLigne.payslipId)).toBe(true);

    const all = await services.salaryRequests.list();
    expect(all.some((r) => r.id === created.id)).toBe(true);
  });

  it('validate(false) rejette avec un motif, sans générer de bulletin', async () => {
    const services = createMockServices();
    const teachers = await services.teachers.list();
    const fixe = teachers.find((t) => t.salaryMode === 'fixe')!;

    const created = await services.salaryRequests.create({
      periode: 'Décembre 2026',
      dateDebut: '01/12/2026',
      dateFin: '31/12/2026',
      lignes: [{ teacherId: fixe.id }],
    });
    await services.salaryRequests.submit(created.id);

    const rejected = await services.salaryRequests.validate(created.id, false, 'Montant à revoir');
    expect(rejected.statut).toBe('rejetee');
    expect(rejected.motifRejet).toBe('Montant à revoir');
    expect(rejected.lignes[0]!.payslipId).toBeNull();
  });

  it('cancel n’annule qu’une demande encore en brouillon', async () => {
    const services = createMockServices();
    const teachers = await services.teachers.list();
    const fixe = teachers.find((t) => t.salaryMode === 'fixe')!;

    const created = await services.salaryRequests.create({
      periode: 'Janvier 2027',
      dateDebut: '01/01/2027',
      dateFin: '31/01/2027',
      lignes: [{ teacherId: fixe.id }],
    });
    const cancelled = await services.salaryRequests.cancel(created.id);
    expect(cancelled.statut).toBe('annulee');
    await expect(services.salaryRequests.cancel(created.id)).rejects.toThrow();
  });

  it('create refuse un enseignant sans salaire configuré', async () => {
    const services = createMockServices();
    const teacher = await services.teachers.create({ nom: 'M. Test Sans Salaire', matiere: 'Test', tel: '00', email: 't@t.sn' });
    await expect(
      services.salaryRequests.create({
        periode: 'Décembre 2026',
        dateDebut: '01/12/2026',
        dateFin: '31/12/2026',
        lignes: [{ teacherId: teacher.id }],
      }),
    ).rejects.toThrow();
  });

  it('staffAbsences.getSummary déduit les jours d’absence non justifiée qui recouvrent la période', async () => {
    const services = createMockServices();
    const teachers = await services.teachers.list();
    const parJour = teachers.find((t) => t.salaryMode === 'par_jour')!;

    const absence = await services.staffAbsences.record(parJour.id, {
      dateDebut: '15/12/2026',
      dateFin: '16/12/2026',
      justifiee: false,
      motif: null,
    });
    expect(absence.id).toBeTruthy();

    const summary = await services.staffAbsences.getSummary(parJour.id, '01/12/2026', '31/12/2026');
    expect(summary.joursInjustifies).toBeGreaterThanOrEqual(2);
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
