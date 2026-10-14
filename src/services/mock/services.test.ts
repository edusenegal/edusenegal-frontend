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
  it('create calcule chaque ligne selon le mode de salaire, puis submit la fait passer en attente (validation hors de cette application)', async () => {
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
    // Statut d'exécution du versement : `null` tant que la demande n'a pas
    // été validée par la comptabilité, hors du périmètre de cette application.
    expect(fixeLigne.statutVersement).toBeNull();

    const submitted = await services.salaryRequests.submit(created.id);
    expect(submitted.statut).toBe('en_attente');
    await expect(services.salaryRequests.submit(created.id)).rejects.toThrow();

    const all = await services.salaryRequests.list();
    expect(all.some((r) => r.id === created.id)).toBe(true);
  });

  it('create résout le mode de paiement de chaque ligne — cash par défaut, numéro du personnel par défaut pour wave/orange money', async () => {
    const services = createMockServices();
    const teachers = await services.teachers.list();
    const fixe = teachers.find((t) => t.salaryMode === 'fixe')!;
    const parHeure = teachers.find((t) => t.salaryMode === 'par_heure')!;

    const created = await services.salaryRequests.create({
      periode: 'Février 2027',
      dateDebut: '01/02/2027',
      dateFin: '28/02/2027',
      lignes: [
        { teacherId: fixe.id },
        { teacherId: parHeure.id, heuresTravaillees: 10, modePaiement: 'wave', destinationPaiement: '78 000 00 00' },
      ],
    });

    const defaultLigne = created.lignes.find((l) => l.teacherId === fixe.id)!;
    expect(defaultLigne.modePaiement).toBe('especes');
    expect(defaultLigne.destinationPaiement).toBeNull();

    const waveLigne = created.lignes.find((l) => l.teacherId === parHeure.id)!;
    expect(waveLigne.modePaiement).toBe('wave');
    expect(waveLigne.destinationPaiement).toBe('78 000 00 00');
  });

  it('create retombe sur le numéro de téléphone du personnel si aucune destination n’est fournie pour wave/orange money', async () => {
    const services = createMockServices();
    const teacher = await services.teachers.create({ nom: 'Mme Test Wave', matiere: 'Test', tel: '77 111 22 33', email: 't@t.sn' });
    await services.teachers.updateSalary(teacher.id, { salaryMode: 'fixe', salaireFixe: 150_000, tauxJournalier: null, tauxHoraire: null });

    const created = await services.salaryRequests.create({
      periode: 'Mars 2027',
      dateDebut: '01/03/2027',
      dateFin: '31/03/2027',
      lignes: [{ teacherId: teacher.id, modePaiement: 'orange_money' }],
    });
    expect(created.lignes[0]!.destinationPaiement).toBe('77 111 22 33');
  });

  it('create refuse wave/orange money sans destination disponible (ni fournie, ni numéro du personnel)', async () => {
    const services = createMockServices();
    const teacher = await services.teachers.create({ nom: 'Mme Test Sans Numéro', matiere: 'Test', tel: '', email: 't@t.sn' });
    await services.teachers.updateSalary(teacher.id, { salaryMode: 'fixe', salaireFixe: 150_000, tauxJournalier: null, tauxHoraire: null });

    await expect(
      services.salaryRequests.create({
        periode: 'Avril 2027',
        dateDebut: '01/04/2027',
        dateFin: '30/04/2027',
        lignes: [{ teacherId: teacher.id, modePaiement: 'wave' }],
      }),
    ).rejects.toThrow();
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

  it('findByPhone distingue un enseignant déjà dans l’établissement, un utilisateur externe à rattacher, et aucun résultat', async () => {
    const services = createMockServices();
    const teachers = await services.teachers.list();
    const existing = teachers[0]!;

    const internal = await services.teachers.findByPhone(existing.tel);
    expect(internal?.dejaDansCetEtablissement).toBe(true);
    expect(internal?.userId).toBe(existing.id);

    const external = await services.teachers.findByPhone('77 520 00 01');
    expect(external?.dejaDansCetEtablissement).toBe(false);
    expect(external?.nom).toBe('M. Alassane Ndour');

    const none = await services.teachers.findByPhone('00 000 00 00');
    expect(none).toBeNull();
  });

  it('attachExisting rattache un utilisateur externe trouvé par téléphone, sans salaire configuré', async () => {
    const services = createMockServices();
    const found = await services.teachers.findByPhone('77 520 00 01');
    expect(found).not.toBeNull();

    const attached = await services.teachers.attachExisting(found!.userId, 'Physique-Chimie');
    expect(attached.matiere).toBe('Physique-Chimie');
    expect(attached.salaryMode).toBeNull();

    const all = await services.teachers.list();
    expect(all.some((t) => t.id === attached.id)).toBe(true);
  });
});

describe('mock services — documents personnels et pédagogiques', () => {
  it('personalDocuments.list filtre par propriétaire et type, upload applique la même règle que le backend', async () => {
    const services = createMockServices();
    const docs = await services.personalDocuments.list('ens-1', 'personnel');
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => d.ownerId === 'ens-1' && d.ownerType === 'personnel')).toBe(true);

    // diplôme/certification réservés au personnel — refusé pour un élève,
    // même règle que `PersonalDocumentServiceImpl.validateTypeForOwner`.
    await expect(
      services.personalDocuments.upload({
        ownerId: 'std-001',
        ownerType: 'eleve',
        type: 'diplome',
        titre: 'Diplôme invalide',
        file: new File(['x'], 'x.pdf'),
      }),
    ).rejects.toThrow();

    const uploaded = await services.personalDocuments.upload({
      ownerId: 'std-001',
      ownerType: 'eleve',
      type: 'cni_parent',
      titre: 'CNI du parent',
      file: new File(['x'], 'cni_parent.pdf'),
    });
    expect(uploaded.ownerId).toBe('std-001');

    await services.personalDocuments.remove(uploaded.id);
    const after = await services.personalDocuments.list('std-001', 'eleve');
    expect(after.some((d) => d.id === uploaded.id)).toBe(false);
  });

  it('courseDocuments.list filtre par matière, upload/remove fonctionnent', async () => {
    const services = createMockServices();
    const docs = await services.courseDocuments.list('subj-math');
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => d.subjectId === 'subj-math')).toBe(true);

    const uploaded = await services.courseDocuments.upload({
      subjectId: 'subj-math',
      type: 'exercice',
      titre: 'Série d’exercices — Dérivées',
      file: new File(['x'], 'exos_derivees.pdf'),
    });
    expect(uploaded.subjectId).toBe('subj-math');

    await services.courseDocuments.remove(uploaded.id);
    const after = await services.courseDocuments.list('subj-math');
    expect(after.some((d) => d.id === uploaded.id)).toBe(false);
  });
});
