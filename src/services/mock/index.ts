/**
 * Implémentation de démonstration des services (branche `mock`).
 *
 * Chaque méthode passe par `respond()`, qui ajoute un court délai : les
 * états de chargement des écrans (squelettes, boutons désactivés pendant
 * l'envoi) sont donc réellement exercés, pas seulement visibles sur un
 * vrai backend lent.
 *
 * L'état est muté en mémoire (cloné depuis les fixtures au démarrage) pour
 * que les actions — créer une classe-événement, approuver un congé,
 * promouvoir un élève — aient un effet visible et persistant pour la durée
 * de la session de l'onglet.
 *
 * POINT DE REMPLACEMENT : ce fichier n'existe que sur la branche `mock`.
 * Une branche `api` fournirait les mêmes interfaces (`@/services/ports`,
 * `createApiServices()`) à partir des vrais endpoints ; aucun écran n'a à
 * changer — voir le README, section "Les deux branches".
 */

import { AppError } from '@/services/errors';
import type { Services } from '@/services/ports';
import type {
  AcademicYearConfig,
  ClassEvent,
  ClassGroup,
  CourseDocument,
  DirectorProfile,
  LeaveRequest,
  Notice,
  PaymentConfig,
  PersonalDocument,
  PromotionResult,
  SalaryRequest,
  SalaryRequestLine,
  SalarySlip,
  School,
  SemesterResult,
  SignedDocument,
  StaffAbsence,
  StaffAbsenceSummary,
  Student,
  Subject,
  SubjectAverage,
  Teacher,
  TeacherLookupResult,
  TransferRequest,
  YearResult,
} from '@/types/domain';
import { frToISO } from '@/utils/format';
import * as fixtures from './fixtures';

const LATENCY_MS = 220;

function respond<T>(value: T, latency = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(value)), latency);
  });
}

function notFound(what: string): never {
  throw new AppError('notFound', `${what} introuvable.`, 404);
}

/**
 * Construit un état isolé pour une session de services.
 *
 * `fixtures.buildAllStudents()` met son résultat en cache (même tableau,
 * mêmes objets, à chaque appel) : sans le cloner ici, deux appels à
 * `createMockServices()` — l'application et un test, ou deux tests —
 * partageraient les mêmes élèves et se verraient mutuellement leurs
 * promotions. `structuredClone` règle ça une fois pour toutes, ici, plutôt
 * que d'imposer à chaque appelant de s'en souvenir.
 */
function createInitialState() {
  const classes = fixtures.buildClasses() as ClassGroup[];
  const students = structuredClone(fixtures.buildAllStudents()) as Student[];
  return {
    school: structuredClone(fixtures.SCHOOL) as School,
    academicYears: structuredClone(fixtures.ACADEMIC_YEARS),
    classes,
    classEvents: structuredClone(fixtures.CLASS_EVENTS) as ClassEvent[],
    teachers: structuredClone(fixtures.buildTeachers()) as Teacher[],
    students,
    subjects: structuredClone(fixtures.buildSubjects()) as Subject[],
    paymentConfig: structuredClone(fixtures.buildPaymentConfig()) as PaymentConfig,
    leaveRequests: structuredClone(fixtures.LEAVE_REQUESTS) as LeaveRequest[],
    staffAbsences: structuredClone(fixtures.STAFF_ABSENCES) as StaffAbsence[],
    salaryRequests: structuredClone(fixtures.SALARY_REQUESTS) as SalaryRequest[],
    salarySlips: structuredClone(fixtures.SALARY_SLIPS) as SalarySlip[],
    signedDocuments: structuredClone(fixtures.SIGNED_DOCUMENTS) as SignedDocument[],
    personalDocuments: structuredClone(fixtures.PERSONAL_DOCUMENTS) as PersonalDocument[],
    courseDocuments: structuredClone(fixtures.COURSE_DOCUMENTS) as CourseDocument[],
    notices: structuredClone(fixtures.NOTICES) as Notice[],
    transferRequests: structuredClone(fixtures.TRANSFER_REQUESTS) as TransferRequest[],
    academicConfigs: structuredClone(fixtures.buildAcademicConfigs()) as AcademicYearConfig[],
    /** Clés `classId|subjectId|semestre` déjà verrouillées (`lockGrades`). */
    lockedGradeKeys: new Set<string>(),
    /** Moyennes par matière déjà calculées (`computeClassAverages`), avant agrégation en résultat. Clé `classId|semestre`. */
    subjectAveragesByClassSemester: {} as Record<string, Record<string, SubjectAverage[]>>, // -> studentId -> matières
    /** Résultats semestriels agrégés (`computeClassResults`). Clé `classId|semestre`. */
    semesterResults: {} as Record<string, SemesterResult[]>,
    /** Année des résultats (academic-service) clôturée — distincte de `AcademicYear.statut`. */
    resultsYearClosed: false,
  };
}

export function createMockServices(): Services {
  /** État muté en mémoire — propre à cette instance de services. */
  const state = createInitialState();

  function recomputeClassEffectifs(): void {
    for (const classe of state.classes) {
      classe.effectif = state.students.filter((s) => s.classeId === classe.id).length;
    }
  }

  /**
   * Jours d'absence justifiée/non justifiée qui recouvrent `[dateDebut,
   * dateFin]` — même logique d'intersection que
   * `StaffAbsenceServiceImpl.getSummary` côté backend : pour chaque absence
   * qui chevauche la période, `max(début absence, début période)` ..
   * `min(fin absence, fin période)`, +1 jour inclusif.
   */
  function computeAbsenceSummary(teacherId: string, dateDebut: string, dateFin: string): { joursJustifies: number; joursInjustifies: number } {
    const from = frToISO(dateDebut);
    const to = frToISO(dateFin);
    let joursJustifies = 0;
    let joursInjustifies = 0;
    for (const absence of state.staffAbsences) {
      if (absence.teacherId !== teacherId) continue;
      const absenceFrom = frToISO(absence.dateDebut);
      const absenceTo = frToISO(absence.dateFin);
      if (absenceFrom > to || absenceTo < from) continue;
      const start = absenceFrom > from ? absenceFrom : from;
      const end = absenceTo < to ? absenceTo : to;
      const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;
      if (absence.justifiee) joursJustifies += days;
      else joursInjustifies += days;
    }
    return { joursJustifies, joursInjustifies };
  }

  return {
    auth: {
      async login(email: string, password: string): Promise<DirectorProfile> {
        if (!email.trim() || password.length < 4) {
          throw new AppError('validation', 'Identifiant ou mot de passe incorrect.', 400);
        }
        return respond<DirectorProfile>(fixtures.DIRECTOR, 380);
      },
      async logout(): Promise<void> {
        await respond(undefined, 80);
      },
      async currentDirector(): Promise<DirectorProfile> {
        return respond(fixtures.DIRECTOR, 60);
      },
    },

    school: {
      async getSchool(): Promise<School> {
        return respond(state.school);
      },
      async updateBranding(patch): Promise<School> {
        state.school = { ...state.school, ...patch };
        return respond(state.school);
      },
      async listAcademicYears() {
        return respond(state.academicYears);
      },
      async openAcademicYear(input) {
        // 1) Classes — upsert par (niveau, série, tag) : une classe qui existe
        // déjà (même nom calculé) est mise à jour (capacité) plutôt que
        // dupliquée ; une classe nouvelle à ce couple niveau/série est créée.
        // Aucune suppression : cette application ne supprime jamais de classe.
        for (const classInput of input.classes) {
          const name = fixtures.classNameOf(classInput);
          const existing = state.classes.find((c) => c.name === name);
          if (existing) {
            existing.capacite = classInput.capacite;
          } else {
            state.classes.push({
              id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              level: classInput.level,
              series: classInput.series,
              tag: classInput.tag,
              name,
              effectif: 0,
              capacite: classInput.capacite,
              homeroomTeacherId: null,
              itinerantTeacherIds: [],
            });
          }
        }

        // 2) Matières & coefficients — upsert par code ; le coefficient saisi
        // pour un couple niveau/série s'applique à toutes les classes qui
        // partagent ce couple (divisions A/B…), classes qui viennent d'être
        // créées ou mises à jour ci-dessus.
        for (const subjectInput of input.subjects) {
          const code = subjectInput.code.trim().toUpperCase();
          let subject = state.subjects.find((s) => s.code === code);
          if (!subject) {
            subject = {
              id: `subj-${Date.now()}-${code}`,
              code,
              nom: subjectInput.nom,
              optionnelle: subjectInput.optionnelle,
              global: false,
              coefficients: [],
            };
            state.subjects.push(subject);
          }
          const byClass = new Map(subject.coefficients.map((c) => [c.classeId, c] as const));
          for (const classe of state.classes) {
            const coef = subjectInput.coefficients.find((sc) => sc.level === classe.level && sc.series === classe.series);
            if (!coef) continue;
            byClass.set(classe.id, { classeId: classe.id, valeur: coef.valeur, enseignee: coef.enseignee });
          }
          subject.coefficients = state.classes.map(
            (classe) => byClass.get(classe.id) ?? { classeId: classe.id, valeur: 0, enseignee: false },
          );
        }

        // 3) Paiements — même upsert qu'un enregistrement direct depuis l'écran dédié.
        state.paymentConfig = {
          ...input.paymentConfig,
          id: state.paymentConfig?.id ?? `paycfg-${Date.now()}`,
          updatedAt: new Date().toLocaleDateString('fr-FR'),
        };

        // 4) Année scolaire — clôture l'année ouverte puis ouvre la nouvelle.
        const year = {
          id: `ay-${Date.now()}`,
          label: input.label,
          statut: 'ouverte' as const,
          dateDebut: input.dateDebut,
          dateFin: input.dateFin,
        };
        for (const existing of state.academicYears) {
          if (existing.statut === 'ouverte') existing.statut = 'cloturee';
        }
        state.academicYears.unshift(year);
        recomputeClassEffectifs();
        return respond(year, 650);
      },
      async closeAcademicYear(yearId) {
        const found = state.academicYears.find((y) => y.id === yearId);
        if (!found) notFound('Année scolaire');
        if (found.statut !== 'ouverte') {
          throw new AppError('validation', `${found.label} n’est pas ouverte.`, 409);
        }
        found.statut = 'cloturee';
        return respond(found, 400);
      },
    },

    dashboard: {
      async getSnapshot() {
        const effectifTotal = state.students.length;
        const effectifGarcons = state.students.filter((s) => s.sexe === 'M').length;
        const effectifFilles = effectifTotal - effectifGarcons;
        const demandesEnAttente =
          state.leaveRequests.filter((l) => l.statut === 'en_attente').length +
          state.salaryRequests.filter((s) => s.statut === 'en_attente').length +
          state.transferRequests.filter((t) => t.statut === 'en_attente').length;
        return respond({
          effectifTotal,
          effectifGarcons,
          effectifFilles,
          presenceDuJour: 94,
          soldeCaisse: 18_450_000,
          demandesEnAttente,
          classesCount: state.classes.length,
          enseignantsCount: state.teachers.length,
        });
      },
    },

    classes: {
      async list(): Promise<ClassGroup[]> {
        return respond(state.classes);
      },
      async get(classId: string): Promise<ClassGroup> {
        const found = state.classes.find((c) => c.id === classId);
        if (!found) notFound('Classe');
        return respond(found);
      },
      async create(input): Promise<ClassGroup> {
        const name = fixtures.classNameOf(input);
        if (state.classes.some((c) => c.name === name)) {
          throw new AppError('validation', `La classe « ${name} » existe déjà.`, 409);
        }
        const homeroomTeacherId = input.homeroomTeacherId ?? null;
        if (homeroomTeacherId && !state.teachers.some((t) => t.id === homeroomTeacherId)) {
          notFound('Enseignant');
        }
        const classe: ClassGroup = {
          id: `cl-${Date.now()}`,
          level: input.level,
          series: input.series,
          tag: input.tag,
          name,
          effectif: 0,
          capacite: input.capacite,
          homeroomTeacherId,
          itinerantTeacherIds: [],
        };
        state.classes.push(classe);
        if (homeroomTeacherId) {
          const teacher = state.teachers.find((t) => t.id === homeroomTeacherId);
          if (teacher && !teacher.classes.includes(name)) teacher.classes.push(name);
        }
        return respond(classe, 350);
      },
      async setHomeroomTeacher(classId: string, teacherId: string | null): Promise<ClassGroup> {
        const classe = state.classes.find((c) => c.id === classId);
        if (!classe) notFound('Classe');
        if (teacherId && !state.teachers.some((t) => t.id === teacherId)) notFound('Enseignant');
        classe.homeroomTeacherId = teacherId;
        if (teacherId) {
          const teacher = state.teachers.find((t) => t.id === teacherId);
          if (teacher && !teacher.classes.includes(classe.name)) teacher.classes.push(classe.name);
        }
        return respond(classe, 300);
      },
      async listEvents(classId: string): Promise<ClassEvent[]> {
        const events = state.classEvents
          .filter((e) => e.classeId === classId)
          .sort((a, b) => a.date.split('/').reverse().join('').localeCompare(b.date.split('/').reverse().join('')));
        return respond(events);
      },
      async planEvent(input): Promise<ClassEvent> {
        const event: ClassEvent = { ...input, id: `cev-${Date.now()}` };
        state.classEvents.push(event);
        return respond(event, 350);
      },
      async getWeeklySchedule(classId: string) {
        return respond(fixtures.buildWeeklySchedule(classId));
      },
    },

    teachers: {
      async list(): Promise<Teacher[]> {
        return respond(state.teachers);
      },
      async get(teacherId: string): Promise<Teacher> {
        const found = state.teachers.find((t) => t.id === teacherId);
        if (!found) notFound('Enseignant');
        return respond(found);
      },
      async create(input): Promise<Teacher> {
        const teacher: Teacher = {
          ...input,
          id: `ens-${Date.now()}`,
          classes: [],
          statut: 'actif',
          salaryMode: null,
          salaireFixe: null,
          tauxJournalier: null,
          tauxHoraire: null,
        };
        state.teachers.unshift(teacher);
        return respond(teacher, 350);
      },
      async findByPhone(tel): Promise<TeacherLookupResult | null> {
        const normalized = tel.trim();
        const inThisSchool = state.teachers.find((t) => t.tel === normalized);
        if (inThisSchool) {
          return respond({
            userId: inThisSchool.id,
            nom: inThisSchool.nom,
            tel: inThisSchool.tel,
            email: inThisSchool.email,
            dejaDansCetEtablissement: true,
          });
        }
        const external = fixtures.EXTERNAL_USER_POOL.find((u) => u.tel === normalized);
        return respond(external ?? null, 300);
      },
      async attachExisting(userId, matiere): Promise<Teacher> {
        const external = fixtures.EXTERNAL_USER_POOL.find((u) => u.userId === userId);
        if (!external) notFound('Utilisateur');
        const teacher: Teacher = {
          id: external.userId,
          nom: external.nom,
          matiere: matiere.trim() || '—',
          tel: external.tel,
          email: external.email,
          statut: 'actif',
          classes: [],
          salaryMode: null,
          salaireFixe: null,
          tauxJournalier: null,
          tauxHoraire: null,
        };
        state.teachers.unshift(teacher);
        return respond(teacher, 350);
      },
      async update(teacherId, patch): Promise<Teacher> {
        const found = state.teachers.find((t) => t.id === teacherId);
        if (!found) notFound('Enseignant');
        Object.assign(found, patch);
        return respond(found);
      },
      async remove(teacherId): Promise<void> {
        state.teachers = state.teachers.filter((t) => t.id !== teacherId);
        await respond(undefined, 250);
      },
      async addClass(teacherId, className): Promise<Teacher> {
        const found = state.teachers.find((t) => t.id === teacherId);
        if (!found) notFound('Enseignant');
        if (!found.classes.includes(className)) found.classes.push(className);
        return respond(found, 200);
      },
      async removeClass(teacherId, className): Promise<Teacher> {
        const found = state.teachers.find((t) => t.id === teacherId);
        if (!found) notFound('Enseignant');
        found.classes = found.classes.filter((c) => c !== className);
        return respond(found, 200);
      },
      async listDocuments(teacherId): Promise<SignedDocument[]> {
        const teacher = state.teachers.find((t) => t.id === teacherId);
        if (!teacher) notFound('Enseignant');
        const shortName = teacher.nom.replace(/^M\.\s|^Mme\s/, '');
        const docs = state.signedDocuments.filter(
          (d) => d.cibleKind === 'personnel' && (d.cible.includes(teacher.nom) || d.cible.includes(shortName)),
        );
        return respond(docs);
      },
      async listPayslips(teacherId): Promise<SalarySlip[]> {
        const slips = state.salarySlips
          .filter((s) => s.teacherId === teacherId)
          .sort((a, b) => frToISO(b.dateGeneration).localeCompare(frToISO(a.dateGeneration)));
        return respond(slips);
      },
      /**
       * Un seul des trois montants est pertinent selon `salaryMode` — même
       * règle que `UserServiceImpl.validateSalaryAmounts` côté backend : le
       * champ attendu doit être renseigné, les deux autres sont ignorés
       * (remis à `null`) pour ne jamais laisser une ancienne valeur
       * incohérente traîner après un changement de mode.
       */
      async updateSalary(teacherId, input): Promise<Teacher> {
        const found = state.teachers.find((t) => t.id === teacherId);
        if (!found) notFound('Enseignant');
        if (input.salaryMode === 'fixe' && !input.salaireFixe) {
          throw new AppError('validation', 'Le salaire fixe doit être renseigné pour le mode « Fixe ».', 422);
        }
        if (input.salaryMode === 'par_jour' && !input.tauxJournalier) {
          throw new AppError('validation', 'Le taux journalier doit être renseigné pour le mode « Par jour travaillé ».', 422);
        }
        if (input.salaryMode === 'par_heure' && !input.tauxHoraire) {
          throw new AppError('validation', 'Le taux horaire doit être renseigné pour le mode « Par heure ».', 422);
        }
        found.salaryMode = input.salaryMode;
        found.salaireFixe = input.salaryMode === 'fixe' ? input.salaireFixe : null;
        found.tauxJournalier = input.salaryMode === 'par_jour' ? input.tauxJournalier : null;
        found.tauxHoraire = input.salaryMode === 'par_heure' ? input.tauxHoraire : null;
        return respond(found, 300);
      },
    },

    students: {
      async list(classId?: string): Promise<Student[]> {
        const rows = classId ? state.students.filter((s) => s.classeId === classId) : state.students;
        return respond(rows);
      },
      async get(studentId): Promise<Student> {
        const found = state.students.find((s) => s.id === studentId);
        if (!found) notFound('Élève');
        return respond(found);
      },
      async create(input): Promise<Student> {
        const classe = state.classes.find((c) => c.id === input.classeId);
        if (!classe) notFound('Classe');
        if (classe.effectif >= classe.capacite) {
          throw new AppError('validation', `${classe.name} a atteint sa capacité (${classe.capacite}).`, 409);
        }
        const student: Student = {
          id: `std-${Date.now()}`,
          prenom: input.prenom,
          nom: input.nom,
          classeId: classe.id,
          classe: classe.name,
          dateNaissance: input.dateNaissance,
          sexe: input.sexe,
          parent: input.parent,
          tel: input.tel,
          statut: 'actif',
          moyenne: 0,
          absences: 0,
          retards: 0,
          tauxPaiement: 0,
          photoUrl: null,
        };
        state.students.push(student);
        recomputeClassEffectifs();
        return respond(student, 350);
      },
      async update(studentId, patch): Promise<Student> {
        const found = state.students.find((s) => s.id === studentId);
        if (!found) notFound('Élève');
        Object.assign(found, patch);
        return respond(found);
      },
      async remove(studentId): Promise<void> {
        const found = state.students.find((s) => s.id === studentId);
        if (!found) notFound('Élève');
        state.students = state.students.filter((s) => s.id !== studentId);
        recomputeClassEffectifs();
        await respond(undefined, 300);
      },
    },

    subjects: {
      async list(): Promise<Subject[]> {
        return respond(state.subjects);
      },
      async get(subjectId): Promise<Subject> {
        const found = state.subjects.find((s) => s.id === subjectId);
        if (!found) notFound('Matière');
        return respond(found);
      },
      async create(input): Promise<Subject> {
        const code = input.code.trim().toUpperCase();
        if (!code) throw new AppError('validation', 'Le code de la matière est obligatoire.', 400);
        if (state.subjects.some((s) => s.code === code)) {
          throw new AppError('validation', `La matière « ${code} » existe déjà.`, 409);
        }
        const subject: Subject = {
          id: `subj-${Date.now()}`,
          code,
          nom: input.nom.trim(),
          optionnelle: input.optionnelle,
          global: false,
          coefficients: state.classes.map((c) => ({ classeId: c.id, valeur: 0, enseignee: false })),
        };
        state.subjects.push(subject);
        return respond(subject, 350);
      },
      async setCoefficients(subjectId, coefficients): Promise<Subject> {
        const found = state.subjects.find((s) => s.id === subjectId);
        if (!found) notFound('Matière');
        found.coefficients = coefficients;
        return respond(found, 350);
      },
      async remove(subjectId): Promise<void> {
        const found = state.subjects.find((s) => s.id === subjectId);
        if (!found) notFound('Matière');
        if (found.global) {
          throw new AppError('validation', 'Les matières du catalogue global ne peuvent pas être supprimées ici.', 409);
        }
        state.subjects = state.subjects.filter((s) => s.id !== subjectId);
        await respond(undefined, 250);
      },
    },

    paymentConfig: {
      async get(): Promise<PaymentConfig | null> {
        return respond(state.paymentConfig);
      },
      async save(input): Promise<PaymentConfig> {
        state.paymentConfig = {
          ...input,
          id: state.paymentConfig?.id ?? `paycfg-${Date.now()}`,
          updatedAt: new Date().toLocaleDateString('fr-FR'),
        };
        return respond(state.paymentConfig, 400);
      },
    },

    promotions: {
      async promoteClass(fromClassId, toClassId) {
        const target = state.classes.find((c) => c.id === toClassId);
        if (!target) notFound('Classe de destination');
        const moved = state.students.filter((s) => s.classeId === fromClassId);
        for (const student of moved) {
          student.classeId = target.id;
          student.classe = target.name;
        }
        recomputeClassEffectifs();
        return respond({ moved: moved.length }, 450);
      },
      async promoteStudent(studentId, toClassId) {
        const student = state.students.find((s) => s.id === studentId);
        const target = state.classes.find((c) => c.id === toClassId);
        if (!student) notFound('Élève');
        if (!target) notFound('Classe de destination');
        student.classeId = target.id;
        student.classe = target.name;
        recomputeClassEffectifs();
        await respond(undefined, 300);
      },
    },

    transfers: {
      async list(): Promise<TransferRequest[]> {
        return respond(state.transferRequests);
      },
      async requestInternal(studentId, toClassId): Promise<TransferRequest> {
        const student = state.students.find((s) => s.id === studentId);
        const target = state.classes.find((c) => c.id === toClassId);
        if (!student) notFound('Élève');
        if (!target) notFound('Classe de destination');
        const request: TransferRequest = {
          id: `tr-${Date.now()}`,
          studentId,
          studentNom: `${student.prenom} ${student.nom}`,
          mode: 'interne',
          classeDepartId: student.classeId,
          classeArriveeId: target.id,
          regionDestination: null,
          ecoleDestination: null,
          statut: 'acceptee',
          date: new Date().toLocaleDateString('fr-FR'),
        };
        state.transferRequests.unshift(request);
        student.classeId = target.id;
        student.classe = target.name;
        recomputeClassEffectifs();
        return respond(request, 400);
      },
      async requestExternal(studentId, region, schoolName): Promise<TransferRequest> {
        const student = state.students.find((s) => s.id === studentId);
        if (!student) notFound('Élève');
        const request: TransferRequest = {
          id: `tr-${Date.now()}`,
          studentId,
          studentNom: `${student.prenom} ${student.nom}`,
          mode: 'externe',
          classeDepartId: student.classeId,
          classeArriveeId: null,
          regionDestination: region,
          ecoleDestination: schoolName,
          statut: 'en_attente',
          date: new Date().toLocaleDateString('fr-FR'),
        };
        state.transferRequests.unshift(request);
        return respond(request, 400);
      },
    },

    leaves: {
      async list(): Promise<LeaveRequest[]> {
        return respond(state.leaveRequests);
      },
      async review(leaveId, approve): Promise<LeaveRequest> {
        const found = state.leaveRequests.find((l) => l.id === leaveId);
        if (!found) notFound('Demande de congé');
        found.statut = approve ? 'approuve' : 'rejete';
        return respond(found, 300);
      },
    },

    staffAbsences: {
      async list(teacherId): Promise<StaffAbsence[]> {
        const rows = state.staffAbsences
          .filter((a) => a.teacherId === teacherId)
          .sort((a, b) => frToISO(b.dateDebut).localeCompare(frToISO(a.dateDebut)));
        return respond(rows);
      },
      async record(teacherId, input): Promise<StaffAbsence> {
        const teacher = state.teachers.find((t) => t.id === teacherId);
        if (!teacher) notFound('Enseignant');
        const absence: StaffAbsence = {
          id: `abs-${Date.now()}`,
          teacherId,
          dateDebut: input.dateDebut,
          dateFin: input.dateFin,
          justifiee: input.justifiee,
          motif: input.motif,
          enregistreePar: `${fixtures.DIRECTOR.prenom} ${fixtures.DIRECTOR.nom}`,
        };
        state.staffAbsences.unshift(absence);
        return respond(absence, 300);
      },
      async remove(absenceId): Promise<void> {
        state.staffAbsences = state.staffAbsences.filter((a) => a.id !== absenceId);
        await respond(undefined, 200);
      },
      async getSummary(teacherId, dateDebut, dateFin): Promise<StaffAbsenceSummary> {
        return respond(computeAbsenceSummary(teacherId, dateDebut, dateFin), 200);
      },
    },

    salaryRequests: {
      async list(): Promise<SalaryRequest[]> {
        return respond(state.salaryRequests);
      },
      /**
       * Une ligne par enseignant choisi — le montant de chaque ligne est
       * calculé ici exactement comme `SalaryPaymentServiceImpl.buildLine`
       * côté backend : FIXED → le montant fixe du profil ; PER_WORKED_DAY →
       * jours payables (jours déclarés moins absences non justifiées sur la
       * période) × taux journalier ; PER_HOUR → heures déclarées × taux
       * horaire. `payeurEtat` reflète `School.ownership` (ici toujours
       * PRIVATE pour cet établissement, voir `fixtures.SCHOOL`).
       */
      async create(input): Promise<SalaryRequest> {
        const payeurEtat = state.school.type !== 'prive';
        const lignes: SalaryRequestLine[] = input.lignes.map(
          ({ teacherId, joursTravailles, heuresTravaillees, modePaiement, destinationPaiement }) => {
            const teacher = state.teachers.find((t) => t.id === teacherId);
            if (!teacher) notFound('Enseignant');
            if (!teacher.salaryMode) {
              throw new AppError(
                'validation',
                `Aucun salaire configuré pour ${teacher.nom} — utilisez « Modifier le salaire » avant de créer la demande.`,
                409,
              );
            }
            // Résolution identique à `SalaryPaymentServiceImpl.buildLine` côté backend :
            // cash par défaut, numéro du personnel par défaut pour wave/orange_money.
            const mode = modePaiement ?? 'especes';
            let destination: string | null = null;
            if (mode === 'wave' || mode === 'orange_money') {
              destination = destinationPaiement?.trim() || teacher.tel;
              if (!destination) {
                throw new AppError(
                  'validation',
                  `Aucun numéro de téléphone disponible pour le cashin ${mode} de ${teacher.nom} — renseignez un numéro.`,
                  422,
                );
              }
            }

            const base = {
              teacherId,
              teacherNom: teacher.nom,
              payeurEtat,
              payslipId: null,
              modePaiement: mode,
              destinationPaiement: destination,
              statutVersement: null,
              referenceTransaction: null,
              motifEchecPaiement: null,
            } as const;

            if (teacher.salaryMode === 'fixe') {
              return {
                ...base,
                salaryMode: 'fixe',
                joursTravailles: null,
                heuresTravaillees: null,
                joursAbsenceInjustifiee: null,
                montantCalcule: teacher.salaireFixe ?? 0,
              };
            }
            if (teacher.salaryMode === 'par_jour') {
              if (joursTravailles == null) {
                throw new AppError('validation', `Le nombre de jours travaillés est requis pour ${teacher.nom}.`, 422);
              }
              const { joursInjustifies } = computeAbsenceSummary(teacherId, input.dateDebut, input.dateFin);
              const joursPayables = Math.max(0, joursTravailles - joursInjustifies);
              return {
                ...base,
                salaryMode: 'par_jour',
                joursTravailles,
                heuresTravaillees: null,
                joursAbsenceInjustifiee: joursInjustifies,
                montantCalcule: joursPayables * (teacher.tauxJournalier ?? 0),
              };
            }
            if (heuresTravaillees == null) {
              throw new AppError('validation', `Le nombre d’heures travaillées est requis pour ${teacher.nom}.`, 422);
            }
            return {
              ...base,
              salaryMode: 'par_heure',
              joursTravailles: null,
              heuresTravaillees,
              joursAbsenceInjustifiee: null,
              montantCalcule: Math.round(heuresTravaillees * (teacher.tauxHoraire ?? 0)),
            };
          },
        );

        const request: SalaryRequest = {
          id: `sr-${Date.now()}`,
          periode: input.periode,
          dateDebut: input.dateDebut,
          dateFin: input.dateFin,
          lignes,
          montantTotal: lignes.reduce((sum, l) => sum + l.montantCalcule, 0),
          statut: 'brouillon',
          dateCreation: new Date().toLocaleDateString('fr-FR'),
          motifRejet: null,
        };
        state.salaryRequests.unshift(request);
        return respond(request, 450);
      },
      async submit(requestId): Promise<SalaryRequest> {
        const found = state.salaryRequests.find((r) => r.id === requestId);
        if (!found) notFound('Demande de paiement');
        if (found.statut !== 'brouillon') {
          throw new AppError('validation', 'Seule une demande en brouillon peut être soumise.', 409);
        }
        found.statut = 'en_attente';
        return respond(found, 300);
      },
      async cancel(requestId): Promise<SalaryRequest> {
        const found = state.salaryRequests.find((r) => r.id === requestId);
        if (!found) notFound('Demande de paiement');
        if (found.statut !== 'brouillon') {
          throw new AppError('validation', 'Seule une demande en brouillon peut être annulée.', 409);
        }
        found.statut = 'annulee';
        return respond(found, 250);
      },
    },

    signatures: {
      async listDocuments(): Promise<SignedDocument[]> {
        return respond(state.signedDocuments);
      },
      async listBulletinPeriods() {
        return respond(fixtures.BULLETIN_PERIODS, 80);
      },
      async signForStudent(studentId, type, period): Promise<SignedDocument> {
        const student = state.students.find((s) => s.id === studentId);
        if (!student) notFound('Élève');
        const periodLabel = period ? fixtures.BULLETIN_PERIODS.find((p) => p.key === period)?.label : null;
        const doc: SignedDocument = {
          serie: `DOC-${Date.now()}`,
          type: periodLabel ? `${type} — ${periodLabel}` : type,
          cible: `${student.prenom} ${student.nom} — ${student.classe}`,
          cibleKind: 'eleve',
          date: new Date().toLocaleDateString('fr-FR'),
          signataire: `${fixtures.DIRECTOR.prenom} ${fixtures.DIRECTOR.nom}`,
        };
        state.signedDocuments.unshift(doc);
        return respond(doc, 450);
      },
      async signForStaff(staffId, type): Promise<SignedDocument> {
        const staff = state.teachers.find((t) => t.id === staffId);
        if (!staff) notFound('Membre du personnel');
        const doc: SignedDocument = {
          serie: `DOC-${Date.now()}`,
          type,
          cible: staff.nom,
          cibleKind: 'personnel',
          date: new Date().toLocaleDateString('fr-FR'),
          signataire: `${fixtures.DIRECTOR.prenom} ${fixtures.DIRECTOR.nom}`,
        };
        state.signedDocuments.unshift(doc);
        return respond(doc, 450);
      },
      async signBulk(classId, period): Promise<{ signed: number }> {
        const roster = state.students.filter((s) => s.classeId === classId);
        const periodLabel = fixtures.BULLETIN_PERIODS.find((p) => p.key === period)?.label ?? '';
        for (const student of roster) {
          state.signedDocuments.unshift({
            serie: `DOC-${Date.now()}-${student.id}`,
            type: `Bulletin — ${periodLabel}`,
            cible: `${student.prenom} ${student.nom} — ${student.classe}`,
            cibleKind: 'eleve',
            date: new Date().toLocaleDateString('fr-FR'),
            signataire: `${fixtures.DIRECTOR.prenom} ${fixtures.DIRECTOR.nom}`,
          });
        }
        return respond({ signed: roster.length }, 600);
      },
      async importToSign(targetKind, targetId, fileName): Promise<SignedDocument> {
        let cible = '';
        if (targetKind === 'eleve') {
          const student = state.students.find((s) => s.id === targetId);
          if (!student) notFound('Élève');
          cible = `${student.prenom} ${student.nom} — ${student.classe}`;
        } else {
          const staff = state.teachers.find((t) => t.id === targetId);
          if (!staff) notFound('Membre du personnel');
          cible = staff.nom;
        }
        const doc: SignedDocument = {
          serie: `DOC-${Date.now()}`,
          type: `Document importé — ${fileName}`,
          cible,
          cibleKind: targetKind,
          date: new Date().toLocaleDateString('fr-FR'),
          signataire: `${fixtures.DIRECTOR.prenom} ${fixtures.DIRECTOR.nom}`,
        };
        state.signedDocuments.unshift(doc);
        return respond(doc, 450);
      },
    },

    notices: {
      async list(): Promise<Notice[]> {
        const sorted = [...state.notices].sort(
          (a, b) => b.date.split('/').reverse().join('').localeCompare(a.date.split('/').reverse().join('')),
        );
        return respond(sorted);
      },
      async create(input): Promise<Notice> {
        const notice: Notice = { ...input, id: `ns-${Date.now()}`, auteur: 'Direction' };
        state.notices.unshift(notice);
        return respond(notice, 350);
      },
    },

    academicResults: {
      async getEffectiveConfig(classId): Promise<AcademicYearConfig | null> {
        if (!classId) return respond(null);
        const config = state.academicConfigs.find((c) => c.classId === classId);
        return respond(config ?? null);
      },
      async configure(input): Promise<AcademicYearConfig> {
        const periods = input.periods.map((p) => ({ ...p, verrouillee: false }));
        const targets = input.classId
          ? state.academicConfigs.filter((c) => c.classId === input.classId)
          : state.academicConfigs; // classId null — portée école entière, cf. doc-comment du port
        for (const config of targets) {
          config.periodType = input.periodType;
          config.semesterCount = input.semesterCount;
          config.periods = periods;
          config.d1Weight = input.d1Weight;
          config.d2Weight = input.d2Weight;
          config.compositionWeight = input.compositionWeight;
          config.minPassAverage = input.minPassAverage;
          config.updatedAt = new Date().toLocaleDateString('fr-FR');
        }
        const result = (input.classId ? targets[0] : targets[0]) ?? null;
        if (!result) notFound('Configuration académique');
        return respond(result);
      },

      async lockGrades(classId, subjectId, semesterNumber): Promise<void> {
        const classe = state.classes.find((c) => c.id === classId);
        if (!classe) notFound('Classe');
        state.lockedGradeKeys.add(`${classId}|${subjectId}|${semesterNumber}`);
        return respond(undefined, 300);
      },

      async computeClassAverages(classId, semesterNumber): Promise<void> {
        const classe = state.classes.find((c) => c.id === classId);
        if (!classe) notFound('Classe');
        const config = state.academicConfigs.find((c) => c.classId === classId);
        const weights = config
          ? { d1Weight: config.d1Weight, d2Weight: config.d2Weight, compositionWeight: config.compositionWeight }
          : { d1Weight: 1, d2Weight: 1, compositionWeight: 2 };
        const key = `${classId}|${semesterNumber}`;
        const byStudent: Record<string, SubjectAverage[]> = {};
        for (const student of state.students.filter((s) => s.classeId === classId)) {
          byStudent[student.id] = fixtures.buildSubjectAveragesForStudent(student, classId, semesterNumber, weights);
        }
        state.subjectAveragesByClassSemester[key] = byStudent;
        return respond(undefined, 500);
      },

      async computeClassResults(classId, semesterNumber): Promise<void> {
        const classe = state.classes.find((c) => c.id === classId);
        if (!classe) notFound('Classe');
        const key = `${classId}|${semesterNumber}`;
        const byStudent = state.subjectAveragesByClassSemester[key];
        if (!byStudent) {
          throw new AppError('validation', "Calculez d'abord les moyennes de cette classe pour ce semestre.", 400);
        }
        const classStudents = state.students.filter((s) => s.classeId === classId);
        const rows = classStudents.map((student) => {
          const matieres = byStudent[student.id] ?? [];
          const totalPoints = matieres.reduce((sum, m) => sum + m.pointsPonderes, 0);
          const totalCoef = matieres.reduce((sum, m) => sum + m.coefficient, 0) || 1;
          const moyenneGenerale = Math.round((totalPoints / totalCoef) * 100) / 100;
          return { student, matieres, moyenneGenerale };
        });
        rows.sort((a, b) => b.moyenneGenerale - a.moyenneGenerale);
        const results: SemesterResult[] = rows.map((row, i) => ({
          id: `semres-${classId}-${semesterNumber}-${row.student.id}`,
          studentId: row.student.id,
          studentNom: `${row.student.prenom} ${row.student.nom}`,
          classId,
          semesterNumber,
          moyenneGenerale: row.moyenneGenerale,
          rangClasse: i + 1,
          totalEleves: rows.length,
          mention: fixtures.mentionFromAverage(row.moyenneGenerale),
          matieres: row.matieres,
          bulletinGenere: false,
          publie: false,
        }));
        state.semesterResults[key] = results;
        return respond(undefined, 500);
      },

      async getClassSemesterResults(classId, semesterNumber): Promise<SemesterResult[]> {
        const results = state.semesterResults[`${classId}|${semesterNumber}`] ?? [];
        return respond(results);
      },

      async publishResults(classId, semesterNumber): Promise<SemesterResult[]> {
        const key = `${classId}|${semesterNumber}`;
        const results = state.semesterResults[key];
        if (!results || results.length === 0) {
          throw new AppError('validation', "Calculez d'abord les résultats de cette classe pour ce semestre.", 400);
        }
        for (const row of results) row.publie = true;
        return respond(results, 400);
      },

      async generateStudentBulletin(studentId, semesterNumber): Promise<void> {
        const row = Object.values(state.semesterResults)
          .flat()
          .find((r) => r.studentId === studentId && r.semesterNumber === semesterNumber);
        if (!row) throw new AppError('validation', "Les résultats de cet élève n'ont pas encore été calculés.", 400);
        row.bulletinGenere = true;
        return respond(undefined, 400);
      },

      async generateClassBulletins(classId, semesterNumber): Promise<void> {
        const key = `${classId}|${semesterNumber}`;
        const results = state.semesterResults[key];
        if (!results || results.length === 0) {
          throw new AppError('validation', "Calculez d'abord les résultats de cette classe pour ce semestre.", 400);
        }
        for (const row of results) row.bulletinGenere = true;
        return respond(undefined, 600);
      },

      async downloadBulletinPdf(studentId, semesterNumber): Promise<void> {
        const row = Object.values(state.semesterResults)
          .flat()
          .find((r) => r.studentId === studentId && r.semesterNumber === semesterNumber);
        if (!row?.bulletinGenere) {
          throw new AppError('validation', "Le bulletin n'a pas encore été généré pour cet élève.", 400);
        }
        return respond(undefined, 300);
      },

      async getClassYearResults(classId): Promise<YearResult[]> {
        const classe = state.classes.find((c) => c.id === classId);
        if (!classe) notFound('Classe');
        const config = state.academicConfigs.find((c) => c.classId === classId);
        const minPassAverage = config?.minPassAverage ?? 10;
        const semesterCount = config?.semesterCount ?? 2;
        const classStudents = state.students.filter((s) => s.classeId === classId);
        const rows = classStudents.map((student) => {
          const semesterRows = Array.from({ length: semesterCount }, (_, i) => i + 1)
            .map((sem) => state.semesterResults[`${classId}|${sem}`]?.find((r) => r.studentId === student.id))
            .filter((r): r is SemesterResult => Boolean(r));
          const moyenneAnnuelle = semesterRows.length
            ? Math.round((semesterRows.reduce((sum, r) => sum + r.moyenneGenerale, 0) / semesterRows.length) * 100) / 100
            : student.moyenne;
          const matieres = semesterRows.at(-1)?.matieres ?? [];
          return { student, moyenneAnnuelle, matieres };
        });
        rows.sort((a, b) => b.moyenneAnnuelle - a.moyenneAnnuelle);
        return respond(
          rows.map((row, i): YearResult => {
            const decision: PromotionResult =
              row.moyenneAnnuelle >= minPassAverage
                ? 'admis'
                : row.moyenneAnnuelle >= minPassAverage - 1
                  ? 'admis_exceptionnel'
                  : 'redouble';
            return {
              id: `yearres-${classId}-${row.student.id}`,
              studentId: row.student.id,
              studentNom: `${row.student.prenom} ${row.student.nom}`,
              classId,
              moyenneAnnuelle: row.moyenneAnnuelle,
              rangClasse: i + 1,
              totalEleves: rows.length,
              mention: fixtures.mentionFromAverage(row.moyenneAnnuelle),
              decision,
              matieres: row.matieres,
              cloture: state.resultsYearClosed,
            };
          }),
        );
      },

      async closeResultsYear(): Promise<void> {
        state.resultsYearClosed = true;
        return respond(undefined, 400);
      },
    },

    personalDocuments: {
      async list(ownerId, ownerType): Promise<PersonalDocument[]> {
        const docs = state.personalDocuments
          .filter((d) => d.ownerId === ownerId && d.ownerType === ownerType)
          .sort((a, b) => frToISO(b.dateDepot).localeCompare(frToISO(a.dateDepot)));
        return respond(docs);
      },
      /**
       * Même règle type/propriétaire que `PersonalDocumentServiceImpl.validateTypeForOwner`
       * côté backend : diplôme/certification réservés au personnel, acte de
       * naissance/CNI des parents réservés à un élève.
       */
      async upload(input): Promise<PersonalDocument> {
        const staffOnly: PersonalDocument['type'][] = ['diplome', 'certification'];
        const studentOnly: PersonalDocument['type'][] = ['acte_naissance', 'cni_parent'];
        if (input.ownerType === 'eleve' && staffOnly.includes(input.type)) {
          throw new AppError('validation', `${input.type} ne s'applique qu'au personnel, pas à un élève.`, 422);
        }
        if (input.ownerType === 'personnel' && studentOnly.includes(input.type)) {
          throw new AppError('validation', `${input.type} ne s'applique qu'à un élève, pas au personnel.`, 422);
        }
        const doc: PersonalDocument = {
          id: `pdoc-${Date.now()}`,
          ownerId: input.ownerId,
          ownerType: input.ownerType,
          type: input.type,
          titre: input.titre.trim(),
          description: input.description?.trim() || null,
          fileName: input.file.name,
          fileSizeBytes: input.file.size,
          downloadUrl: '#',
          deposePar: `${fixtures.DIRECTOR.prenom} ${fixtures.DIRECTOR.nom}`,
          dateDepot: new Date().toLocaleDateString('fr-FR'),
        };
        state.personalDocuments.unshift(doc);
        return respond(doc, 400);
      },
      async remove(documentId): Promise<void> {
        state.personalDocuments = state.personalDocuments.filter((d) => d.id !== documentId);
        await respond(undefined, 250);
      },
    },

    courseDocuments: {
      async list(subjectId): Promise<CourseDocument[]> {
        const docs = state.courseDocuments
          .filter((d) => d.subjectId === subjectId)
          .sort((a, b) => frToISO(b.dateDepot).localeCompare(frToISO(a.dateDepot)));
        return respond(docs);
      },
      async upload(input): Promise<CourseDocument> {
        const doc: CourseDocument = {
          id: `cdoc-${Date.now()}`,
          subjectId: input.subjectId,
          type: input.type,
          titre: input.titre.trim(),
          description: input.description?.trim() || null,
          fileName: input.file.name,
          fileSizeBytes: input.file.size,
          downloadUrl: '#',
          deposePar: `${fixtures.DIRECTOR.prenom} ${fixtures.DIRECTOR.nom}`,
          dateDepot: new Date().toLocaleDateString('fr-FR'),
        };
        state.courseDocuments.unshift(doc);
        return respond(doc, 400);
      },
      async remove(documentId): Promise<void> {
        state.courseDocuments = state.courseDocuments.filter((d) => d.id !== documentId);
        await respond(undefined, 250);
      },
    },
  };
}
