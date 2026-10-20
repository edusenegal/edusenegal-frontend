import type {
  AccountantProfile,
  CashSession,
  Expense,
  ExpenseCategory,
  ExpenseDecision,
  ExpenseStatus,
  LedgerGranularity,
  LedgerHistory,
  PaymentChannel,
  PaymentTransaction,
  PaymentType,
  PayrollStaffMember,
  RestoTicketPurchase,
  SalaryRequest,
  SalarySlip,
  Scholarship,
  School,
  SchoolLedger,
  StudentPickerEntry,
  StudentWallet,
  WalletCreditType,
  WalletTransaction,
} from '@/types/domain';

/**
 * Connexion et session — même contrat que `apps/director` (même
 * `/api/v1/auth/login`, même passerelle), seul le profil renvoyé change de
 * forme (`AccountantProfile` plutôt que `DirectorProfile`).
 */
export interface AuthPort {
  login(identifier: string, password: string, loginByPhone: boolean): Promise<AccountantProfile>;
  logout(): Promise<void>;
  currentAccountant(): Promise<AccountantProfile>;
}

/** Lecture seule — le comptable ne modifie ni le branding ni l'année scolaire. */
export interface SchoolPort {
  getSchool(): Promise<School>;
}

/**
 * Demandes de paiement générales — traduit `ExpenseController`
 * (payment-service). Toutes les étapes du circuit sont exposées ici :
 * contrairement à `apps/director`, qui ne propose que la création et la
 * soumission (voir son `SalaryRequestsPort`), c'est CETTE application qui
 * porte la décision finale — `validate` — réservée au comptable.
 */
export interface ExpensesPort {
  /** Backend : `GET /api/v1/accounting/expenses?schoolId&academicYearId&status&category`. */
  list(filters?: { status?: ExpenseStatus; category?: ExpenseCategory }): Promise<Expense[]>;
  /** Backend : `GET /api/v1/accounting/expenses/{id}`. */
  findById(expenseId: string): Promise<Expense>;
  /**
   * Saisie d'une nouvelle dépense (statut brouillon). Le comptable comme
   * le directeur peuvent créer — voir `@PreAuthorize` sur `ExpenseController.create`.
   * Backend : `POST /api/v1/accounting/expenses`.
   */
  create(input: {
    categorie: ExpenseCategory;
    libelle: string;
    montantFcfa: number;
    dateDepense: string; // dd/mm/yyyy
    fournisseur?: string;
  }): Promise<Expense>;
  /** Backend : `POST /api/v1/accounting/expenses/{id}/submit`. */
  submit(expenseId: string): Promise<Expense>;
  /**
   * Décision du comptable. `commentaire` est obligatoire côté backend pour
   * un rejet (voir `ValidateExpenseRequest`).
   * Backend : `POST /api/v1/accounting/expenses/{id}/validate`.
   */
  validate(expenseId: string, decision: ExpenseDecision, commentaire?: string): Promise<Expense>;
  /** Backend : `POST /api/v1/accounting/expenses/{id}/cancel`. Réservé à une dépense brouillon/en attente. */
  cancel(expenseId: string): Promise<Expense>;
  /** Backend : `POST /api/v1/accounting/expenses/{id}/attachments` (multipart). */
  attachFile(expenseId: string, file: File): Promise<Expense>;
  /**
   * Téléchargement authentifié d'un justificatif (fetch + téléchargement
   * local), jamais le lien MinIO présigné brut (`Expense.piecesJointes`),
   * qui peut être indisponible ou mal résolu depuis le navigateur.
   * Backend : `GET /api/v1/accounting/expenses/{id}/attachments/{index}/download`.
   */
  downloadAttachment(expenseId: string, index: number, suggestedFilename: string): Promise<void>;
}

/**
 * Session de caisse journalière du comptable connecté — traduit
 * `CashSessionController` (payment-service). `getCurrent` renvoie `null`
 * (jamais une erreur) quand aucune session n'est ouverte aujourd'hui pour
 * CE comptable : c'est l'état normal avant le premier `open()` de la
 * journée, pas une anomalie.
 */
export interface CashSessionsPort {
  /** Backend : `POST /api/v1/accounting/cash-sessions/open` — idempotent. */
  open(): Promise<CashSession>;
  /**
   * Backend : `POST /api/v1/accounting/cash-sessions/close`. `gapJustification`
   * est obligatoire côté backend dès que le comptage physique diffère du
   * solde théorique — l'écran doit donc relire l'erreur de validation plutôt
   * que de la deviner à l'avance.
   */
  close(physicalCountFcfa: number, gapJustification?: string): Promise<CashSession>;
  /** Backend : `GET /api/v1/accounting/cash-sessions/current`. */
  getCurrent(): Promise<CashSession | null>;
  /** Backend : `GET /api/v1/accounting/cash-sessions/history?from=&to=` (dd/mm/yyyy ici, converti en ISO). */
  getHistory(from: string, to: string): Promise<CashSession[]>;
}

/**
 * Grand livre de l'école — traduit `LedgerController` (payment-service).
 * Lecture seule : le solde est recalculé côté backend à chaque encaissement
 * élève complété ou dépense validée, jamais depuis cette application.
 */
export interface LedgerPort {
  /** Backend : `GET /api/v1/accounting/ledger`. */
  get(): Promise<SchoolLedger>;
  /**
   * Backend : `GET /api/v1/accounting/ledger/history` -- historique daté
   * des entrées/sorties (dashboard comptable + export Excel, task #268/#269).
   * `from`/`to` au format ISO `yyyy-MM-dd`.
   */
  getHistory(granularity: LedgerGranularity, from: string, to: string): Promise<LedgerHistory>;
}

/**
 * Paiement des salaires — traduit `SalaryPaymentController` (payment-service).
 * L'ACCOUNTANT peut enchaîner les quatre étapes lui-même (création,
 * soumission, décision finale, annulation) — contrairement à
 * `apps/director`, dont le `SalaryRequestsPort` s'arrête volontairement à
 * la soumission : la décision finale suppose l'écran de contrôle de solde
 * que seule cette application porte (voir `validate`).
 */
export interface SalaryPaymentsPort {
  /** Backend : `GET /api/v1/accounting/salary-requests?schoolId&academicYearId&status`. */
  list(filters?: { status?: SalaryRequest['statut'] }): Promise<SalaryRequest[]>;
  /** Backend : `GET /api/v1/accounting/salary-requests/{id}`. */
  findById(requestId: string): Promise<SalaryRequest>;
  /**
   * Personnel enseignant de l'établissement (TEACHER + INSTITUTEUR) avec son
   * profil de salaire — seul personnel dont le salaire est aujourd'hui
   * configurable (voir `PayrollStaffMember`).
   * Backend : `GET /api/v1/users/school/{schoolId}?role=TEACHER|INSTITUTEUR`
   * puis `GET /api/v1/users/{id}/schools/{schoolId}/salary` (user-service).
   */
  listPayableStaff(): Promise<PayrollStaffMember[]>;
  /**
   * Crée une demande en brouillon — une ligne par personnel choisi. Le
   * montant de chaque ligne est calculé côté serveur à partir de son profil
   * de salaire et, en mode "par jour", de ses absences non justifiées sur
   * la période ; jamais saisi ici.
   * Backend : `POST /api/v1/accounting/salary-requests`.
   */
  create(input: {
    periode: string; // "2026-10"
    dateDebut: string; // dd/mm/yyyy — premier jour de la période
    dateFin: string; // dd/mm/yyyy — dernier jour de la période
    lignes: {
      staffUserId: string;
      joursTravailles?: number;
      heuresTravaillees?: number;
      /** cash par défaut si omis. */
      modePaiement?: PaymentChannel;
      /** Numéro de téléphone pour wave/orange_money — celui du personnel par défaut si omis. */
      destinationPaiement?: string;
    }[];
  }): Promise<SalaryRequest>;
  /** Backend : `POST /api/v1/accounting/salary-requests/{id}/submit`. */
  submit(requestId: string): Promise<SalaryRequest>;
  /**
   * Décision finale. `selectedStaffUserIds` : sous-ensemble à régler
   * MAINTENANT quand le solde de l'école ne couvre pas la totalité (l'appel
   * sans sélection échoue alors avec `INSUFFICIENT_BALANCE`) — le reliquat
   * part dans une nouvelle demande brouillon, voir `SalaryRequest.splitIntoRequestId`
   * sur la réponse. Ignoré si `decision === 'rejete'`.
   * Backend : `POST /api/v1/accounting/salary-requests/{id}/validate`.
   */
  validate(
    requestId: string,
    decision: ExpenseDecision,
    options?: { comment?: string; selectedStaffUserIds?: string[] },
  ): Promise<SalaryRequest>;
  /** Backend : `POST /api/v1/accounting/salary-requests/{id}/cancel`. Réservé à une demande brouillon. */
  cancel(requestId: string): Promise<SalaryRequest>;
  /** Backend : `GET /api/v1/accounting/salary-requests/payslips?schoolId&staffUserId`. */
  listPayslips(staffUserId: string): Promise<SalarySlip[]>;
  /**
   * Téléchargement du bulletin de paie en PDF — fetch + téléchargement local
   * (comme les bulletins scolaires signés, `apps/director`), jamais un lien
   * direct : le PDF est derrière un endpoint authentifié.
   * Backend : `GET /api/v1/accounting/salary-requests/payslips/{id}/pdf`.
   */
  downloadPayslipPdf(payslip: SalarySlip): Promise<void>;
}

/**
 * Recherche d'élève par nom/prénom — portage minimal (voir
 * `StudentPickerEntry`), seul besoin aujourd'hui du picker de `WalletPage`.
 * Backend : `GET /api/v1/users/school/{schoolId}?role=STUDENT` (user-service)
 * + `GET /api/v1/classes/school/{schoolId}/year/{yearId}` pour la classe.
 */
export interface StudentsPort {
  /** Filtré côté frontend sur nom/prénom ; `query` vide renvoie []. */
  search(query: string): Promise<StudentPickerEntry[]>;
  /**
   * Effectif complet de l'école — utilisé pour résoudre un nom d'élève à
   * partir d'un `studentId` dans un écran qui n'en connaît que l'id (ex.
   * `ScholarshipsPage`, vue école/par payeur) : `GET /api/v1/users/{userId}`
   * seul ne couvre pas ACCOUNTANT côté backend.
   */
  listAll(): Promise<StudentPickerEntry[]>;
}

/**
 * Portefeuille campus élève — lecture pour tout comptable de l'école,
 * crédit/débit réservés aux corrections manuelles exceptionnelles (jamais la
 * voie d'un achat de ticket resto, qui reste géré par `RestoTicketService`
 * côté backend). Backend : `WalletController` (payment-service).
 */
export interface WalletPort {
  get(studentId: string): Promise<StudentWallet>;
  getHistory(studentId: string): Promise<WalletTransaction[]>;
  /**
   * `note` obligatoire côté backend pour `credit_manuel` uniquement — les
   * deux autres types tracent un versement déjà réconcilié ailleurs.
   * Backend : `POST /api/v1/payments/wallet/student/{studentId}/credits`.
   */
  credit(studentId: string, input: { amountFcfa: number; type: WalletCreditType; note?: string }): Promise<StudentWallet>;
  /** Backend : `POST /api/v1/payments/wallet/student/{studentId}/debits`. */
  debit(studentId: string, input: { amountFcfa: number; note: string }): Promise<StudentWallet>;
}

/**
 * Encaissements élèves — lecture + enregistrement d'un paiement en espèces
 * (le seul canal que ce rôle encaisse directement ; Wave/Orange Money
 * passent par leurs webhooks respectifs, jamais saisis manuellement).
 * Backend : `PaymentController` (payment-service).
 */
export interface PaymentsPort {
  /** Backend : `GET /api/v1/payments/student/{studentId}`. */
  getHistory(studentId: string): Promise<PaymentTransaction[]>;
  /** Backend : `POST /api/v1/payments/cash`. */
  recordCash(input: {
    studentId: string;
    type: PaymentType;
    amountFcfa: number;
    period?: string;
    installmentNumber?: number;
    totalInstallments?: number;
    dueDate?: string; // dd/mm/yyyy
    note?: string;
  }): Promise<PaymentTransaction>;
  /** URL présignée du reçu PDF (généré à la volée si absent). Backend : `GET /{transactionId}/receipt`. */
  getReceiptUrl(transactionId: string): Promise<string>;
}

/**
 * Tickets de restaurant universitaire — lecture seule ici : l'achat est
 * réservé à l'élève, le pointage au personnel de cantine (voir
 * `RestoTicketController`).
 */
export interface RestoTicketsPort {
  /** Backend : `GET /api/v1/payments/resto/tickets/student/{studentId}`. */
  getHistory(studentId: string): Promise<RestoTicketPurchase[]>;
}

/**
 * Dossiers de bourse — lecture (par élève, par école, par structure
 * payeuse) et enregistrement des versements de tranches reçus du payeur.
 * Création/validation/activation du dossier restent hors périmètre
 * comptable (rôles DIRECTOR/SUPERVISOR côté backend — voir
 * `ScholarshipController`, dont les `@PreAuthorize` sont aujourd'hui tous
 * commentés : à réactiver le jour où direction obtient son propre écran).
 */
export interface ScholarshipsPort {
  /** `null` si l'élève n'a pas de dossier de bourse pour l'année active. */
  findByStudent(studentId: string): Promise<Scholarship | null>;
  /** Backend : `GET /api/v1/scholarships/school/{schoolId}`. */
  listBySchool(): Promise<Scholarship[]>;
  /** Recherche par nom (partiel, insensible à la casse) de la structure payeuse. */
  listByPayer(payerName: string): Promise<Scholarship[]>;
  /**
   * Enregistre un versement reçu de la structure payeuse sur une tranche —
   * jamais un virement déclenché par la plateforme, simple traçage d'un
   * paiement déjà reçu ailleurs (même principe que `WalletPort.credit`).
   * Backend : `POST /api/v1/scholarships/{scholarshipId}/slices` (multipart).
   */
  recordSlicePayment(
    scholarshipId: string,
    input: {
      sliceId: string;
      paidFcfa: number;
      paidDate: string; // dd/mm/yyyy
      channel: PaymentChannel;
      note?: string;
      paymentProof?: File;
    },
  ): Promise<Scholarship>;
}

/** Point d'assemblage unique de l'espace comptabilité. */
export interface Services {
  auth: AuthPort;
  school: SchoolPort;
  expenses: ExpensesPort;
  cashSessions: CashSessionsPort;
  ledger: LedgerPort;
  salaryPayments: SalaryPaymentsPort;
  students: StudentsPort;
  wallet: WalletPort;
  payments: PaymentsPort;
  restoTickets: RestoTicketsPort;
  scholarships: ScholarshipsPort;
}
