/**
 * Données de démonstration de la branche `mock`.
 *
 * Un seul établissement, un seul niveau : un lycée privé sénégalais, ses 8
 * classes (Seconde → Terminale), son personnel enseignant et ~80 élèves.
 * Volontairement limité au lycée — ni primaire, ni collège, ni université —
 * conformément au périmètre demandé pour cette application.
 *
 * Les élèves sont générés par un petit générateur déterministe (seed fixe)
 * plutôt que tapés à la main : 80 lignes identiques en forme n'apportent
 * rien à relire, et la génération garantit des données stables entre deux
 * rechargements (mêmes notes, mêmes absences) — utile pour les tests comme
 * pour les captures d'écran.
 *
 * POINT DE REMPLACEMENT : ce fichier n'existe que sur la branche `mock`.
 * Une branche `api` fournirait les mêmes interfaces (`@/services/ports`) à
 * partir des vrais endpoints ; aucun écran n'aurait à changer.
 */

import type {
  AcademicPeriod,
  AcademicYear,
  AcademicYearConfig,
  BulletinPeriod,
  ClassEvent,
  ClassGroup,
  ClassLevel,
  CourseDocument,
  LeaveRequest,
  Mention,
  Notice,
  PaymentConfig,
  PersonalDocument,
  SalaryRequest,
  SalarySlip,
  ScheduleSlot,
  School,
  SignedDocument,
  StaffAbsence,
  Student,
  Subject,
  SubjectAverage,
  Teacher,
  TeacherLookupResult,
  TransferRequest,
} from '@/types/domain';

export const SCHOOL: School = {
  id: 'sch-flamboyants',
  name: 'Lycée Privé Les Flamboyants',
  type: 'prive',
  niveau: 'lycee',
  region: 'Dakar',
  adresse: 'Sacré-Cœur 3, Dakar',
  telephone: '+221 33 824 12 40',
  email: 'direction@lyceelesflamboyants.sn',
  logoUrl: null,
  brandColor: '#1D9E75',
  devise: 'XOF',
};

export const DIRECTOR = {
  id: 'dir-1',
  prenom: 'Aminata',
  nom: 'Diagne',
  role: 'DIRECTOR' as const,
  email: 'a.diagne@lyceelesflamboyants.sn',
};

export const ACADEMIC_YEARS: AcademicYear[] = [
  { id: 'ay-2627', label: '2026-2027', statut: 'ouverte', dateDebut: '02/09/2026', dateFin: '30/06/2027' },
  { id: 'ay-2526', label: '2025-2026', statut: 'cloturee', dateDebut: '01/09/2025', dateFin: '28/06/2026' },
];

/* ------------------------------------------------------------------ */
/* Classes                                                             */
/* ------------------------------------------------------------------ */

interface ClassSeed {
  id: string;
  level: ClassLevel;
  series: string | null;
  tag: string | null;
  capacite: number;
}

const CLASS_SEEDS: ClassSeed[] = [
  { id: 'cl-2a', level: 'Seconde', series: null, tag: 'A', capacite: 42 },
  { id: 'cl-2b', level: 'Seconde', series: null, tag: 'B', capacite: 42 },
  { id: 'cl-1l', level: 'Première', series: 'L', tag: null, capacite: 38 },
  { id: 'cl-1s1', level: 'Première', series: 'S1', tag: null, capacite: 40 },
  { id: 'cl-1s2', level: 'Première', series: 'S2', tag: null, capacite: 40 },
  { id: 'cl-tl', level: 'Terminale', series: 'L', tag: null, capacite: 36 },
  { id: 'cl-ts1', level: 'Terminale', series: 'S1', tag: null, capacite: 38 },
  { id: 'cl-ts2', level: 'Terminale', series: 'S2', tag: null, capacite: 38 },
];

/**
 * Exporté pour `services/mock/index.ts` (`classes.create`) : une classe créée
 * à la main doit se nommer exactement comme celles des fixtures (même ordre
 * niveau/série/division), pas une variante locale au service.
 */
export function classNameOf(seed: { level: ClassLevel; series: string | null; tag: string | null }): string {
  const parts = [seed.level, seed.series, seed.tag].filter(Boolean);
  return parts.join(' ');
}

/* ------------------------------------------------------------------ */
/* Enseignants                                                        */
/* ------------------------------------------------------------------ */

/**
 * `salaryMode` mélange volontairement les trois modes (voir `SalaryMode`,
 * backend) pour exercer les trois branches de calcul dès les données de
 * démonstration : la plupart des enseignants sont au fixe (mode le plus
 * courant pour un poste permanent), deux sont rémunérés au jour travaillé
 * (ex. un remplaçant), et le professeur d'EPS — qui intervient sur presque
 * toutes les classes mais à temps partiel — est rémunéré à l'heure.
 */
interface TeacherSeed {
  id: string;
  nom: string;
  matiere: string;
  tel: string;
  email: string;
  salaryMode: TeacherSeedSalaryMode;
  salaireFixe: number | null;
  tauxJournalier: number | null;
  tauxHoraire: number | null;
  classes: string[]; // noms de classes
}

type TeacherSeedSalaryMode = 'fixe' | 'par_jour' | 'par_heure';

const TEACHER_SEEDS: TeacherSeed[] = [
  { id: 'ens-1', nom: 'M. Ibrahima Sarr', matiere: 'Mathématiques', tel: '77 501 22 10', email: 'i.sarr@lyceelesflamboyants.sn', salaryMode: 'fixe', salaireFixe: 320000, tauxJournalier: null, tauxHoraire: null, classes: ['Terminale S1', 'Terminale S2', 'Première S2'] },
  { id: 'ens-2', nom: 'Mme Awa Diop', matiere: 'Physique-Chimie', tel: '77 502 33 21', email: 'a.diop@lyceelesflamboyants.sn', salaryMode: 'fixe', salaireFixe: 300000, tauxJournalier: null, tauxHoraire: null, classes: ['Terminale S2', 'Première S1', 'Première S2'] },
  { id: 'ens-3', nom: 'M. Modou Fallou Kane', matiere: 'Sciences de la Vie et de la Terre', tel: '77 503 44 32', email: 'm.kane@lyceelesflamboyants.sn', salaryMode: 'par_jour', salaireFixe: null, tauxJournalier: 14000, tauxHoraire: null, classes: ['Terminale S1', 'Première S1', 'Seconde A'] },
  { id: 'ens-4', nom: 'Mme Khady Mbaye', matiere: 'Français', tel: '77 504 55 43', email: 'k.mbaye@lyceelesflamboyants.sn', salaryMode: 'fixe', salaireFixe: 260000, tauxJournalier: null, tauxHoraire: null, classes: ['Seconde A', 'Seconde B', 'Première L'] },
  { id: 'ens-5', nom: 'M. Pathé Gueye', matiere: 'Anglais', tel: '77 505 66 54', email: 'p.gueye@lyceelesflamboyants.sn', salaryMode: 'par_jour', salaireFixe: null, tauxJournalier: 12500, tauxHoraire: null, classes: ['Terminale S2', 'Terminale L', 'Seconde B'] },
  { id: 'ens-6', nom: 'Mme Ndèye Fatou Cissé', matiere: 'Philosophie', tel: '77 506 77 65', email: 'n.cisse@lyceelesflamboyants.sn', salaryMode: 'fixe', salaireFixe: 270000, tauxJournalier: null, tauxHoraire: null, classes: ['Terminale L', 'Terminale S1', 'Terminale S2'] },
  { id: 'ens-7', nom: 'M. Babacar Thiam', matiere: 'Histoire-Géographie', tel: '77 507 88 76', email: 'b.thiam@lyceelesflamboyants.sn', salaryMode: 'fixe', salaireFixe: 255000, tauxJournalier: null, tauxHoraire: null, classes: ['Seconde A', 'Seconde B', 'Première L'] },
  { id: 'ens-8', nom: 'M. Ousmane Diallo', matiere: 'Éducation Physique et Sportive', tel: '77 508 99 87', email: 'o.diallo@lyceelesflamboyants.sn', salaryMode: 'par_heure', salaireFixe: null, tauxJournalier: null, tauxHoraire: 3500, classes: ['Seconde A', 'Seconde B', 'Première L', 'Première S1', 'Première S2', 'Terminale L', 'Terminale S1', 'Terminale S2'] },
  { id: 'ens-9', nom: 'Mme Soda Niang', matiere: 'Espagnol', tel: '77 509 10 98', email: 's.niang@lyceelesflamboyants.sn', salaryMode: 'fixe', salaireFixe: 235000, tauxJournalier: null, tauxHoraire: null, classes: ['Première S1', 'Première S2', 'Terminale S1'] },
  { id: 'ens-10', nom: 'M. Cheikh Faye', matiere: 'Sciences Économiques et Sociales', tel: '77 510 21 09', email: 'c.faye@lyceelesflamboyants.sn', salaryMode: 'fixe', salaireFixe: 245000, tauxJournalier: null, tauxHoraire: null, classes: ['Première L', 'Terminale L'] },
];

export function buildTeachers(): Teacher[] {
  return TEACHER_SEEDS.map((seed) => ({
    id: seed.id,
    nom: seed.nom,
    matiere: seed.matiere,
    tel: seed.tel,
    email: seed.email,
    statut: 'actif',
    classes: [...seed.classes],
    salaryMode: seed.salaryMode,
    salaireFixe: seed.salaireFixe,
    tauxJournalier: seed.tauxJournalier,
    tauxHoraire: seed.tauxHoraire,
  }));
}

/** Quelques absences de démonstration — alimentent `StaffAbsencesPort` et le calcul "par jour". */
export const STAFF_ABSENCES: StaffAbsence[] = [
  { id: 'abs-1', teacherId: 'ens-3', dateDebut: '14/10/2026', dateFin: '14/10/2026', justifiee: true, motif: 'Rendez-vous médical', enregistreePar: 'Direction' },
  { id: 'abs-2', teacherId: 'ens-3', dateDebut: '02/10/2026', dateFin: '03/10/2026', justifiee: false, motif: null, enregistreePar: 'Direction' },
  { id: 'abs-3', teacherId: 'ens-5', dateDebut: '09/10/2026', dateFin: '09/10/2026', justifiee: false, motif: null, enregistreePar: 'Direction' },
];

/** Enseignants d'une classe — titulaire (professeur principal) en premier. */
export function teacherNamesForClass(className: string): string[] {
  return TEACHER_SEEDS.filter((t) => t.classes.includes(className)).map((t) => t.id);
}

/**
 * Utilisateurs EXISTANTS mais pas encore dans CET établissement — alimente
 * la démo du dédoublonnage à la création d'un enseignant (recherche par
 * téléphone trouvant quelqu'un déjà connu, ex. enseignant itinérant d'une
 * autre école). `77 520 00 01` est le seul numéro de cette liste utilisable
 * pour la démo ; tout autre numéro non présent dans `TEACHER_SEEDS` renvoie
 * `null` (aucun utilisateur trouvé).
 */
export const EXTERNAL_USER_POOL: TeacherLookupResult[] = [
  { userId: 'usr-ext-1', nom: 'M. Alassane Ndour', tel: '77 520 00 01', email: 'a.ndour@gmail.com', dejaDansCetEtablissement: false },
];

/** Quelques pièces personnelles de démonstration — enseignant ens-1 et élève std-001. */
export const PERSONAL_DOCUMENTS: PersonalDocument[] = [
  { id: 'pdoc-1', ownerId: 'ens-1', ownerType: 'personnel', type: 'cni', titre: 'Carte nationale d’identité', description: null, fileName: 'cni_isarr.pdf', fileSizeBytes: 182_000, downloadUrl: '#', deposePar: 'Direction', dateDepot: '03/09/2026' },
  { id: 'pdoc-2', ownerId: 'ens-1', ownerType: 'personnel', type: 'diplome', titre: 'Diplôme de Master — Mathématiques', description: "Université Cheikh Anta Diop, 2014", fileName: 'diplome_master_isarr.pdf', fileSizeBytes: 340_000, downloadUrl: '#', deposePar: 'Direction', dateDepot: '03/09/2026' },
  { id: 'pdoc-3', ownerId: 'std-001', ownerType: 'eleve', type: 'cni', titre: 'Carte nationale d’identité', description: null, fileName: 'cni_eleve.pdf', fileSizeBytes: 150_000, downloadUrl: '#', deposePar: 'Direction', dateDepot: '01/09/2026' },
  { id: 'pdoc-4', ownerId: 'std-001', ownerType: 'eleve', type: 'acte_naissance', titre: 'Acte de naissance', description: null, fileName: 'acte_naissance_eleve.pdf', fileSizeBytes: 210_000, downloadUrl: '#', deposePar: 'Direction', dateDepot: '01/09/2026' },
];

/** Quelques documents pédagogiques de démonstration, matière Mathématiques. */
export const COURSE_DOCUMENTS: CourseDocument[] = [
  { id: 'cdoc-1', subjectId: 'subj-math', type: 'cours', titre: 'Chapitre 3 — Suites numériques', description: null, fileName: 'chap3_suites.pdf', fileSizeBytes: 420_000, downloadUrl: '#', deposePar: 'M. Ibrahima Sarr', dateDepot: '28/09/2026' },
  { id: 'cdoc-2', subjectId: 'subj-math', type: 'sujet_examen', titre: 'Devoir surveillé n°1', description: 'Terminale S2', fileName: 'ds1_ts2.pdf', fileSizeBytes: 95_000, downloadUrl: '#', deposePar: 'M. Ibrahima Sarr', dateDepot: '05/10/2026' },
];

/* ------------------------------------------------------------------ */
/* Élèves — générés, seed fixe pour des données stables                */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRENOMS_F = ['Fatou', 'Aïssatou', 'Khady', 'Ndèye', 'Awa', 'Mariama', 'Bineta', 'Sokhna', 'Adama', 'Rokhaya', 'Dieynaba', 'Astou'];
const PRENOMS_M = ['Moussa', 'Mamadou', 'Ibrahima', 'Ousmane', 'Cheikh', 'Modou', 'Babacar', 'Lamine', 'Alioune', 'Pape', 'Serigne', 'Bakary'];
const NOMS = ['Ndiaye', 'Diop', 'Fall', 'Sarr', 'Gueye', 'Mbaye', 'Kane', 'Cissé', 'Diallo', 'Thiam', 'Niang', 'Sow', 'Faye', 'Camara', 'Ba', 'Diagne'];

function buildStudentsForClass(seed: ClassSeed, rand: () => number, startIndex: number): Student[] {
  const className = classNameOf(seed);
  const count = Math.max(8, Math.min(14, Math.round(seed.capacite * 0.3)));
  const students: Student[] = [];
  for (let i = 0; i < count; i += 1) {
    const sexe: 'M' | 'F' = rand() > 0.48 ? 'M' : 'F';
    const prenom = sexe === 'F'
      ? PRENOMS_F[Math.floor(rand() * PRENOMS_F.length)]!
      : PRENOMS_M[Math.floor(rand() * PRENOMS_M.length)]!;
    const nom = NOMS[Math.floor(rand() * NOMS.length)]!;
    const birthYear = seed.level === 'Seconde' ? 2010 : seed.level === 'Première' ? 2009 : 2008;
    const day = 1 + Math.floor(rand() * 27);
    const month = 1 + Math.floor(rand() * 12);
    const moyenne = Math.round((8 + rand() * 11) * 10) / 10;
    const absences = Math.floor(rand() * 9);
    const retards = Math.floor(rand() * 5);
    const tauxPaiement = Math.round(55 + rand() * 45);
    const num = String(startIndex + i + 1).padStart(3, '0');
    students.push({
      id: `std-${num}`,
      prenom,
      nom,
      classeId: seed.id,
      classe: className,
      dateNaissance: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${birthYear}`,
      sexe,
      parent: `${sexe === 'F' ? 'M.' : 'Mme'} ${NOMS[Math.floor(rand() * NOMS.length)]}`,
      tel: `77 ${600 + Math.floor(rand() * 300)} ${10 + Math.floor(rand() * 89)} ${10 + Math.floor(rand() * 89)}`,
      statut: 'actif',
      moyenne,
      absences,
      retards,
      tauxPaiement,
      photoUrl: null,
    });
  }
  return students;
}

export function buildClasses(): ClassGroup[] {
  const allStudents = buildAllStudents();
  return CLASS_SEEDS.map((seed) => {
    const className = classNameOf(seed);
    const teacherIds = teacherNamesForClass(className);
    const effectif = allStudents.filter((s) => s.classeId === seed.id).length;
    return {
      id: seed.id,
      level: seed.level,
      series: seed.series,
      tag: seed.tag,
      name: className,
      effectif,
      capacite: seed.capacite,
      homeroomTeacherId: teacherIds[0] ?? null,
      itinerantTeacherIds: teacherIds.slice(1),
    };
  });
}

let cachedStudents: Student[] | null = null;

export function buildAllStudents(): Student[] {
  if (cachedStudents) return cachedStudents;
  const rand = mulberry32(42);
  const students: Student[] = [];
  for (const seed of CLASS_SEEDS) {
    students.push(...buildStudentsForClass(seed, rand, students.length));
  }
  cachedStudents = students;
  return students;
}

/* ------------------------------------------------------------------ */
/* Matières & coefficients                                            */
/* ------------------------------------------------------------------ */

interface SubjectCoefficientSeed {
  classId: string;
  value: number;
  enseignee: boolean;
}

interface SubjectSeed {
  id: string;
  code: string;
  nom: string;
  optionnelle: boolean;
  global: boolean;
  coefficients: SubjectCoefficientSeed[];
}

const SUBJECT_CLASS_IDS = CLASS_SEEDS.map((c) => c.id);

/**
 * `spec` ne couvre que les classes où la matière est enseignée ; les classes
 * omises sont complétées en coefficient 0 / non enseignée — pas besoin de
 * répéter les 8 classes pour une matière qui n'existe qu'en série L, par
 * exemple.
 */
function coefficients(spec: Record<string, [value: number, enseignee: boolean]>): SubjectCoefficientSeed[] {
  return SUBJECT_CLASS_IDS.map((classId) => {
    const [value, enseignee] = spec[classId] ?? [0, false];
    return { classId, value, enseignee };
  });
}

const SUBJECT_SEEDS: SubjectSeed[] = [
  {
    id: 'subj-math',
    code: 'MATH',
    nom: 'Mathématiques',
    optionnelle: false,
    global: true,
    coefficients: coefficients({
      'cl-2a': [4, true],
      'cl-2b': [4, true],
      'cl-1l': [2, true],
      'cl-1s1': [5, true],
      'cl-1s2': [5, true],
      'cl-tl': [2, true],
      'cl-ts1': [6, true],
      'cl-ts2': [5, true],
    }),
  },
  {
    id: 'subj-pc',
    code: 'PC',
    nom: 'Physique-Chimie',
    optionnelle: false,
    global: true,
    // Pas enseignée en série L (cl-1l, cl-tl) : laissée à [0, false].
    coefficients: coefficients({
      'cl-2a': [3, true],
      'cl-2b': [3, true],
      'cl-1s1': [4, true],
      'cl-1s2': [5, true],
      'cl-ts1': [6, true],
      'cl-ts2': [5, true],
    }),
  },
  {
    id: 'subj-svt',
    code: 'SVT',
    nom: 'Sciences de la Vie et de la Terre',
    optionnelle: false,
    global: true,
    coefficients: coefficients({
      'cl-2a': [2, true],
      'cl-2b': [2, true],
      'cl-1s1': [2, true],
      'cl-1s2': [4, true],
      'cl-ts1': [2, true],
      'cl-ts2': [4, true],
    }),
  },
  {
    id: 'subj-fr',
    code: 'FR',
    nom: 'Français',
    optionnelle: false,
    global: true,
    // Épreuve de Français uniquement jusqu'en Première.
    coefficients: coefficients({
      'cl-2a': [4, true],
      'cl-2b': [4, true],
      'cl-1l': [5, true],
      'cl-1s1': [3, true],
      'cl-1s2': [3, true],
    }),
  },
  {
    id: 'subj-ang',
    code: 'ANG',
    nom: 'Anglais',
    optionnelle: false,
    global: true,
    coefficients: coefficients({
      'cl-2a': [2, true],
      'cl-2b': [2, true],
      'cl-1l': [3, true],
      'cl-1s1': [2, true],
      'cl-1s2': [2, true],
      'cl-tl': [3, true],
      'cl-ts1': [2, true],
      'cl-ts2': [2, true],
    }),
  },
  {
    id: 'subj-philo',
    code: 'PHILO',
    nom: 'Philosophie',
    optionnelle: false,
    global: true,
    // Philosophie démarre en Terminale.
    coefficients: coefficients({
      'cl-tl': [4, true],
      'cl-ts1': [2, true],
      'cl-ts2': [2, true],
    }),
  },
  {
    id: 'subj-hg',
    code: 'HG',
    nom: 'Histoire-Géographie',
    optionnelle: false,
    global: true,
    coefficients: coefficients({
      'cl-2a': [3, true],
      'cl-2b': [3, true],
      'cl-1l': [3, true],
      'cl-1s1': [2, true],
      'cl-1s2': [2, true],
      'cl-tl': [4, true],
      'cl-ts1': [2, true],
      'cl-ts2': [2, true],
    }),
  },
  {
    id: 'subj-eps',
    code: 'EPS',
    nom: 'Éducation Physique et Sportive',
    optionnelle: false,
    global: true,
    coefficients: coefficients({
      'cl-2a': [1, true],
      'cl-2b': [1, true],
      'cl-1l': [1, true],
      'cl-1s1': [1, true],
      'cl-1s2': [1, true],
      'cl-tl': [1, true],
      'cl-ts1': [1, true],
      'cl-ts2': [1, true],
    }),
  },
  {
    id: 'subj-esp',
    code: 'ESP',
    nom: 'Espagnol',
    optionnelle: true,
    global: false,
    // Enseignée partout mais facultative (coefficient 0) en Terminale S2 —
    // illustre la distinction « facultative » / « non enseignée ».
    coefficients: coefficients({
      'cl-2a': [2, true],
      'cl-2b': [2, true],
      'cl-1l': [2, true],
      'cl-1s1': [2, true],
      'cl-1s2': [2, true],
      'cl-tl': [2, true],
      'cl-ts1': [2, true],
      'cl-ts2': [0, true],
    }),
  },
  {
    id: 'subj-ses',
    code: 'SES',
    nom: 'Sciences Économiques et Sociales',
    optionnelle: false,
    global: false,
    // Propre à la série L.
    coefficients: coefficients({
      'cl-1l': [2, true],
      'cl-tl': [2, true],
    }),
  },
];

export function buildSubjects(): Subject[] {
  return SUBJECT_SEEDS.map((seed) => ({
    id: seed.id,
    code: seed.code,
    nom: seed.nom,
    optionnelle: seed.optionnelle,
    global: seed.global,
    coefficients: seed.coefficients.map((c) => ({ classeId: c.classId, valeur: c.value, enseignee: c.enseignee })),
  }));
}

/* ------------------------------------------------------------------ */
/* Paiements — configuration des frais de scolarité                   */
/* ------------------------------------------------------------------ */

/**
 * Configuration initiale, réaliste pour un lycée privé dakarois : frais
 * d'inscription + scolarité trimestrielle, par niveau (pas de distinction
 * par série — `series` reste `null`, comme le permet `LevelPricing`
 * côté backend). `totalAnnualFcfa` est calculé ici une fois, exactement
 * comme l'écran le recalculera à chaque modification côté direction.
 */
function levelPricing(level: string, displayName: string, inscriptionFcfa: number, periodFcfa: number, periods: number) {
  return {
    level,
    series: null,
    displayName,
    inscriptionFcfa,
    periodFcfa,
    totalAnnualFcfa: inscriptionFcfa + periodFcfa * periods,
  };
}

export function buildPaymentConfig(): PaymentConfig {
  return {
    id: 'paycfg-sch-flamboyants',
    type: 'inscription_trimestriel',
    levelPricings: [
      levelPricing('Seconde', 'Seconde', 50000, 150000, 3),
      levelPricing('Première', 'Première', 55000, 160000, 3),
      levelPricing('Terminale', 'Terminale', 60000, 175000, 3),
    ],
    installmentAllowed: true,
    maxInstallments: 3,
    deferredAllowed: true,
    maxDeferDays: 15,
    alertDaysBefore: 5,
    enabledChannels: ['wave', 'orange_money', 'especes'],
    updatedAt: '15/09/2026',
  };
}

/* ------------------------------------------------------------------ */
/* Devoirs, examens, compositions                                     */
/* ------------------------------------------------------------------ */

export const CLASS_EVENTS: ClassEvent[] = [
  { id: 'cev-1', classeId: 'cl-ts2', type: 'Devoir', titre: 'Devoir n°2', matiere: 'Physique-Chimie', date: '20/10/2026', notes: '' },
  { id: 'cev-2', classeId: 'cl-ts2', type: 'Composition', titre: 'Composition du 1er trimestre', matiere: 'Toutes matières', date: '10/11/2026', notes: '' },
  { id: 'cev-3', classeId: 'cl-ts2', type: 'Conseil de classe', titre: 'Conseil de classe', matiere: null, date: '15/11/2026', notes: '' },
  { id: 'cev-4', classeId: 'cl-1s1', type: 'Devoir', titre: 'Devoir n°1', matiere: 'Mathématiques', date: '17/10/2026', notes: '' },
  { id: 'cev-5', classeId: 'cl-2a', type: 'Devoir', titre: 'Devoir n°1', matiere: 'Français', date: '22/10/2026', notes: '' },
  { id: 'cev-6', classeId: 'cl-tl', type: 'Examen', titre: 'Examen blanc — Philosophie', matiere: 'Philosophie', date: '05/11/2026', notes: 'Préparation au bac' },
];

/* ------------------------------------------------------------------ */
/* Emploi du temps                                                    */
/* ------------------------------------------------------------------ */

const DAYS: ScheduleSlot['jour'][] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const PERIODS = [
  { start: '08:00', end: '09:00' },
  { start: '09:00', end: '10:00' },
  { start: '10:15', end: '11:15' },
  { start: '11:15', end: '12:15' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
];

export function buildWeeklySchedule(classId: string): ScheduleSlot[] {
  const className = buildClasses().find((c) => c.id === classId)?.name ?? '';
  const teacherIds = teacherNamesForClass(className);
  if (teacherIds.length === 0) return [];
  const slots: ScheduleSlot[] = [];
  let cursor = 0;
  for (const jour of DAYS) {
    const periodCount = jour === 'Samedi' ? 2 : 5;
    for (let p = 0; p < periodCount; p += 1) {
      const period = PERIODS[p]!;
      if (jour !== 'Samedi' && p === 3) {
        slots.push({ jour, heureDebut: period.start, heureFin: period.end, matiere: null, enseignantId: null, salle: null, kind: 'libre' });
        continue;
      }
      const teacherId = teacherIds[cursor % teacherIds.length]!;
      const teacher = TEACHER_SEEDS.find((t) => t.id === teacherId)!;
      slots.push({
        jour,
        heureDebut: period.start,
        heureFin: period.end,
        matiere: teacher.matiere,
        enseignantId: teacher.id,
        salle: `Salle ${1 + (cursor % 8)}`,
        kind: 'cours',
      });
      cursor += 1;
    }
  }
  return slots;
}

/* ------------------------------------------------------------------ */
/* RH — congés, salaires                                              */
/* ------------------------------------------------------------------ */

export const LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'cg-301', teacherId: 'ens-4', teacherNom: 'Mme Khady Mbaye', dateDebut: '14/10/2026', dateFin: '17/10/2026', motif: 'Raisons médicales', statut: 'approuve', remplacant: 'M. Babacar Thiam', pieceJointe: { nom: 'certificat_medical_kmbaye.pdf' } },
  { id: 'cg-302', teacherId: 'ens-7', teacherNom: 'M. Babacar Thiam', dateDebut: '02/11/2026', dateFin: '03/11/2026', motif: 'Convocation administrative', statut: 'en_attente', remplacant: null, pieceJointe: { nom: 'convocation_administrative_bthiam.pdf' } },
  { id: 'cg-303', teacherId: 'ens-9', teacherNom: 'Mme Soda Niang', dateDebut: '20/10/2026', dateFin: '20/10/2026', motif: 'Événement familial', statut: 'en_attente', remplacant: null, pieceJointe: null },
  { id: 'cg-304', teacherId: 'ens-2', teacherNom: 'Mme Awa Diop', dateDebut: '10/09/2026', dateFin: '12/09/2026', motif: 'Congé de maternité — suivi médical', statut: 'rejete', remplacant: null, pieceJointe: { nom: 'justificatif_adiop.pdf' } },
];

/** `payeurEtat: false` partout — `SCHOOL.type === 'prive'` (voir plus haut), donc `SchoolOwnership.PRIVATE` côté backend : l'école paie, jamais l'État. */
export const SALARY_SLIPS: SalarySlip[] = [
  { id: 'pay-1', teacherId: 'ens-1', periode: 'Septembre 2026', salaryMode: 'fixe', montantBrut: 320000, joursTravailles: null, heuresTravaillees: null, joursAbsenceInjustifiee: null, payeurEtat: false, dateGeneration: '30/09/2026' },
  { id: 'pay-2', teacherId: 'ens-1', periode: 'Août 2026', salaryMode: 'fixe', montantBrut: 320000, joursTravailles: null, heuresTravaillees: null, joursAbsenceInjustifiee: null, payeurEtat: false, dateGeneration: '31/08/2026' },
  { id: 'pay-3', teacherId: 'ens-2', periode: 'Septembre 2026', salaryMode: 'fixe', montantBrut: 300000, joursTravailles: null, heuresTravaillees: null, joursAbsenceInjustifiee: null, payeurEtat: false, dateGeneration: '30/09/2026' },
  { id: 'pay-4', teacherId: 'ens-3', periode: 'Septembre 2026', salaryMode: 'par_jour', montantBrut: 308000, joursTravailles: 22, heuresTravaillees: null, joursAbsenceInjustifiee: 0, payeurEtat: false, dateGeneration: '30/09/2026' },
];

/**
 * Quatre statuts représentés pour exercer tout le circuit dans l'écran
 * « Demandes de salaire » : sr-401 déjà validée (ses lignes portent les
 * `payslipId` de SALARY_SLIPS ci-dessus — règlement automatique à la
 * validation, voir `SalaryPaymentServiceImpl.settleLine`), sr-402 soumise et
 * en attente de décision, sr-403 encore en brouillon, sr-404 rejetée.
 */
export const SALARY_REQUESTS: SalaryRequest[] = [
  {
    id: 'sr-401',
    periode: 'Septembre 2026',
    dateDebut: '01/09/2026',
    dateFin: '30/09/2026',
    statut: 'validee',
    dateCreation: '28/09/2026',
    motifRejet: null,
    montantTotal: 928000,
    lignes: [
      { teacherId: 'ens-1', teacherNom: 'M. Ibrahima Sarr', salaryMode: 'fixe', joursTravailles: null, heuresTravaillees: null, joursAbsenceInjustifiee: null, montantCalcule: 320000, payeurEtat: false, payslipId: 'pay-1', modePaiement: 'virement_bancaire', destinationPaiement: null, statutVersement: 'paye', referenceTransaction: null, motifEchecPaiement: null },
      { teacherId: 'ens-2', teacherNom: 'Mme Awa Diop', salaryMode: 'fixe', joursTravailles: null, heuresTravaillees: null, joursAbsenceInjustifiee: null, montantCalcule: 300000, payeurEtat: false, payslipId: 'pay-3', modePaiement: 'wave', destinationPaiement: '77 502 33 21', statutVersement: 'paye', referenceTransaction: 'WAVE-SIM-7731240095', motifEchecPaiement: null },
      { teacherId: 'ens-3', teacherNom: 'M. Modou Fallou Kane', salaryMode: 'par_jour', joursTravailles: 22, heuresTravaillees: null, joursAbsenceInjustifiee: 0, montantCalcule: 308000, payeurEtat: false, payslipId: 'pay-4', modePaiement: 'especes', destinationPaiement: null, statutVersement: 'paye', referenceTransaction: null, motifEchecPaiement: null },
    ],
  },
  {
    id: 'sr-402',
    periode: 'Octobre 2026',
    dateDebut: '01/10/2026',
    dateFin: '31/10/2026',
    statut: 'en_attente',
    dateCreation: '05/10/2026',
    motifRejet: null,
    montantTotal: 497500,
    lignes: [
      { teacherId: 'ens-4', teacherNom: 'Mme Khady Mbaye', salaryMode: 'fixe', joursTravailles: null, heuresTravaillees: null, joursAbsenceInjustifiee: null, montantCalcule: 260000, payeurEtat: false, payslipId: null, modePaiement: 'cheque', destinationPaiement: null, statutVersement: null, referenceTransaction: null, motifEchecPaiement: null },
      { teacherId: 'ens-5', teacherNom: 'M. Pathé Gueye', salaryMode: 'par_jour', joursTravailles: 20, heuresTravaillees: null, joursAbsenceInjustifiee: 1, montantCalcule: 237500, payeurEtat: false, payslipId: null, modePaiement: 'orange_money', destinationPaiement: '77 505 66 54', statutVersement: null, referenceTransaction: null, motifEchecPaiement: null },
    ],
  },
  {
    id: 'sr-403',
    periode: 'Octobre 2026',
    dateDebut: '01/10/2026',
    dateFin: '31/10/2026',
    statut: 'brouillon',
    dateCreation: '10/10/2026',
    motifRejet: null,
    montantTotal: 140000,
    lignes: [
      { teacherId: 'ens-8', teacherNom: 'M. Ousmane Diallo', salaryMode: 'par_heure', joursTravailles: null, heuresTravaillees: 40, joursAbsenceInjustifiee: null, montantCalcule: 140000, payeurEtat: false, payslipId: null, modePaiement: 'wave', destinationPaiement: '77 508 99 87', statutVersement: null, referenceTransaction: null, motifEchecPaiement: null },
    ],
  },
  {
    id: 'sr-404',
    periode: 'Septembre 2026',
    dateDebut: '01/09/2026',
    dateFin: '30/09/2026',
    statut: 'rejetee',
    dateCreation: '25/09/2026',
    motifRejet: "Montant à vérifier avec le profil de l'enseignante — doublon avec sr-401.",
    montantTotal: 235000,
    lignes: [
      { teacherId: 'ens-9', teacherNom: 'Mme Soda Niang', salaryMode: 'fixe', joursTravailles: null, heuresTravaillees: null, joursAbsenceInjustifiee: null, montantCalcule: 235000, payeurEtat: false, payslipId: null, modePaiement: 'especes', destinationPaiement: null, statutVersement: null, referenceTransaction: null, motifEchecPaiement: null },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Documents & signatures                                             */
/* ------------------------------------------------------------------ */

export const BULLETIN_PERIODS: BulletinPeriod[] = [
  { key: 't1', label: '1er trimestre', available: true },
  { key: 't2', label: '2e trimestre', available: true },
  { key: 't3', label: '3e trimestre', available: false },
];

export const SIGNED_DOCUMENTS: SignedDocument[] = [
  { serie: 'BUL-2026-00841', type: 'Bulletin — 1er trimestre', cible: 'Fatou Ndiaye — Terminale S2', cibleKind: 'eleve', date: '12/10/2026', signataire: 'Aminata Diagne' },
  { serie: 'BUL-2026-00842', type: 'Bulletin — 1er trimestre', cible: 'Moussa Diallo — Terminale S1', cibleKind: 'eleve', date: '12/10/2026', signataire: 'Aminata Diagne' },
  { serie: 'CERT-2026-00112', type: 'Certificat de scolarité', cible: 'Khady Sow — Première S2', cibleKind: 'eleve', date: '05/10/2026', signataire: 'Aminata Diagne' },
  { serie: 'ATTW-2026-00033', type: 'Attestation de travail', cible: 'M. Ibrahima Sarr', cibleKind: 'personnel', date: '08/10/2026', signataire: 'Aminata Diagne' },
  { serie: 'DOCADM-2026-00019', type: 'Document administratif', cible: 'Mme Khady Mbaye', cibleKind: 'personnel', date: '14/10/2026', signataire: 'Aminata Diagne' },
  { serie: 'ATTP-2026-00008', type: 'Certificat de présence', cible: 'M. Babacar Thiam', cibleKind: 'personnel', date: '02/11/2026', signataire: 'Aminata Diagne' },
];

/* ------------------------------------------------------------------ */
/* Notes de service / annonces                                        */
/* ------------------------------------------------------------------ */

export const NOTICES: Notice[] = [
  { id: 'ns-101', titre: 'Reprise des cours de soutien', corps: 'Les cours de soutien du samedi reprennent dès le 18 octobre pour les classes de Terminale.', destType: 'personnel', destLabel: 'Personnel', date: '10/10/2026', auteur: 'Direction' },
  { id: 'ns-102', titre: 'Journée pédagogique', corps: "L'établissement sera fermé aux élèves le 9 octobre pour une journée pédagogique du corps enseignant.", destType: 'ecole', destLabel: "Toute l'école", date: '09/10/2026', auteur: 'Direction' },
  { id: 'ns-103', titre: 'Conseil de classe — Terminale S2', corps: 'Le conseil de classe se tiendra le 15 novembre à 15h en salle des professeurs.', destType: 'classe', destLabel: 'Terminale S2', date: '15/10/2026', auteur: 'Direction' },
  { id: 'ns-104', titre: 'Clôture des paiements du 2ème versement', corps: "Le deuxième versement de la scolarité doit être réglé avant le 31 octobre.", destType: 'ecole', destLabel: "Toute l'école", date: '20/10/2026', auteur: 'Direction' },
];

/* ------------------------------------------------------------------ */
/* Transferts                                                         */
/* ------------------------------------------------------------------ */

export const TRANSFER_REQUESTS: TransferRequest[] = [
  { id: 'tr-1', studentId: buildAllStudents()[0]?.id ?? 'std-001', studentNom: `${buildAllStudents()[0]?.prenom ?? ''} ${buildAllStudents()[0]?.nom ?? ''}`, mode: 'interne', classeDepartId: 'cl-2a', classeArriveeId: 'cl-2b', regionDestination: null, ecoleDestination: null, statut: 'en_attente', date: '11/10/2026' },
  { id: 'tr-2', studentId: buildAllStudents()[1]?.id ?? 'std-002', studentNom: `${buildAllStudents()[1]?.prenom ?? ''} ${buildAllStudents()[1]?.nom ?? ''}`, mode: 'externe', classeDepartId: 'cl-1s1', classeArriveeId: null, regionDestination: 'Thiès', ecoleDestination: 'Lycée Malick Sy', statut: 'acceptee', date: '30/09/2026' },
];

export const REGIONS: Record<string, string[]> = {
  Dakar: ['Lycée John F. Kennedy', 'Lycée Blaise Diagne', 'Lycée Seydina Limamoulaye'],
  Thiès: ['Lycée Malick Sy', 'Lycée El Hadji Omar Lamine Badiane'],
  'Saint-Louis': ['Lycée Charles de Gaulle', 'Lycée El Hadji Amadou Malick Gaye'],
  Ziguinchor: ['Lycée Djignabo'],
};

export function schoolsOfRegionAZ(region: string): string[] {
  return [...(REGIONS[region] ?? [])].sort((a, b) => a.localeCompare(b));
}

/* ------------------------------------------------------------------ */
/* Résultats & bulletins                                              */
/* ------------------------------------------------------------------ */

/** Traduit `Mention.fromAverage` (academic-service) — mêmes seuils. */
export function mentionFromAverage(avg: number): Mention {
  if (avg >= 18) return 'excellent';
  if (avg >= 16) return 'tres_bien';
  if (avg >= 14) return 'bien';
  if (avg >= 12) return 'assez_bien';
  if (avg >= 10) return 'passable';
  return 'insuffisant';
}

/**
 * Configuration académique par défaut (semestres, pondérations D1/D2/
 * Composition, moyenne de passage) — une par classe, comme la résolution de
 * portée réelle (`classId` prioritaire sur `levelTarget`/école). Pondération
 * 1/1/2 : pratique courante au lycée sénégalais (la composition pèse autant
 * que les deux devoirs réunis).
 */
function academicPeriodsFor(anneeLabel: string): AcademicPeriod[] {
  const [startYear, endYear] = anneeLabel.split('-').map(Number) as [number, number];
  return [
    {
      number: 1,
      label: 'Semestre 1',
      dateDebut: `02/09/${startYear}`,
      dateFin: `20/12/${startYear}`,
      dateLimiteNotes: `15/12/${startYear}`,
      dateBulletin: `22/12/${startYear}`,
      verrouillee: false,
    },
    {
      number: 2,
      label: 'Semestre 2',
      dateDebut: `05/01/${endYear}`,
      dateFin: `30/06/${endYear}`,
      dateLimiteNotes: `20/06/${endYear}`,
      dateBulletin: `27/06/${endYear}`,
      verrouillee: false,
    },
  ];
}

export function buildAcademicConfigs(): AcademicYearConfig[] {
  const anneeOuverte = ACADEMIC_YEARS.find((y) => y.statut === 'ouverte') ?? ACADEMIC_YEARS[0]!;
  return CLASS_SEEDS.map((seed) => ({
    id: `acfg-${seed.id}`,
    levelTarget: null,
    classId: seed.id,
    periodType: 'semestre',
    semesterCount: 2,
    periods: academicPeriodsFor(anneeOuverte.label),
    d1Weight: 1,
    d2Weight: 1,
    compositionWeight: 2,
    minPassAverage: 10,
    updatedAt: '01/09/2026',
  }));
}

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Moyennes par matière d'un élève pour un semestre — dérivées de façon
 * déterministe de `Student.moyenne` (seed = identifiant élève + semestre, pas
 * de dépendance à l'ordre d'appel). Ne couvre que les matières réellement
 * enseignées dans sa classe (`enseignee: true`), comme le fait le vrai calcul
 * côté `academic-service` (une matière non enseignée n'a pas de moyenne).
 */
export function buildSubjectAveragesForStudent(
  student: Student,
  classId: string,
  semesterNumber: number,
  weights: { d1Weight: number; d2Weight: number; compositionWeight: number },
): SubjectAverage[] {
  const rand = mulberry32(hashStringToInt(`${student.id}|${classId}|sem${semesterNumber}`));
  const totalWeight = weights.d1Weight + weights.d2Weight + weights.compositionWeight || 1;
  return buildSubjects()
    .map((subj) => ({ subj, coef: subj.coefficients.find((c) => c.classeId === classId) }))
    .filter((x) => x.coef?.enseignee)
    .map(({ subj, coef }) => {
      const base = student.moyenne;
      const note = () => Math.round(Math.max(0, Math.min(20, base + (rand() - 0.5) * 5)) * 100) / 100;
      const d1 = note();
      const d2 = note();
      const composition = note();
      const moyenne = Math.round(
        ((d1 * weights.d1Weight + d2 * weights.d2Weight + composition * weights.compositionWeight) / totalWeight) * 100,
      ) / 100;
      return {
        subjectId: subj.id,
        subjectNom: subj.nom,
        d1,
        d2,
        composition,
        moyenne,
        coefficient: coef!.valeur,
        pointsPonderes: Math.round(moyenne * coef!.valeur * 100) / 100,
        mention: mentionFromAverage(moyenne),
      };
    });
}
