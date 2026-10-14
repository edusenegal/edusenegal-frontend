import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, DateInput, Field, Input, Segmented, Select, StateView, Textarea } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF, isoToFR, todayISO } from '@/utils/format';
import type { SalaryMode, Teacher } from '@/types/domain';
import { PersonalDocumentsSection } from '@/components/documents/PersonalDocumentsSection';
import { TeacherFormSheet } from './TeacherFormSheet';
import styles from './TeacherDetailPage.module.css';

type Tab = 'profil' | 'classes' | 'documents' | 'remuneration' | 'absences';

const SALARY_MODE_LABEL: Record<SalaryMode, string> = {
  fixe: 'Fixe (mensuel)',
  par_jour: 'Par jour travaillé',
  par_heure: 'Par heure',
};

export default function TeacherDetailPage() {
  const { teacherId = '' } = useParams();
  const navigate = useNavigate();
  const { teachers, classes } = useServices();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('profil');
  const [editOpen, setEditOpen] = useState(false);
  const [classToAdd, setClassToAdd] = useState('');

  const teacherQuery = useQuery({ queryKey: ['teacher', teacherId], queryFn: () => teachers.get(teacherId) });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const documents = useQuery({
    queryKey: ['teacher-documents', teacherId],
    queryFn: () => teachers.listDocuments(teacherId),
    enabled: tab === 'documents',
  });

  const t = teacherQuery.data;

  const addClassMutation = useMutation({
    mutationFn: (className: string) => teachers.addClass(teacherId, className),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', teacherId] });
      setClassToAdd('');
    },
  });
  const removeClassMutation = useMutation({
    mutationFn: (className: string) => teachers.removeClass(teacherId, className),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teacher', teacherId] }),
  });

  const availableClasses = (classList.data ?? []).filter((c) => !(t?.classes ?? []).includes(c.name));

  const tabs: { value: Tab; label: string }[] = [
    { value: 'profil', label: 'Profil' },
    { value: 'classes', label: 'Classes' },
    { value: 'documents', label: 'Documents' },
    { value: 'remuneration', label: 'Rémunération' },
    { value: 'absences', label: 'Absences' },
  ];

  return (
    <div>
      <Link to="/enseignants" className={styles.back}>
        ← Enseignants
      </Link>
      <PageHeader
        title={t?.nom ?? '…'}
        subtitle={t ? `${t.matiere} · ${t.classes.join(', ') || 'Aucune classe'}` : undefined}
        action={
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            ✎ Modifier
          </Button>
        }
      />

      <StateView loading={teacherQuery.isLoading} error={teacherQuery.error}>
        <Card>
          <Segmented<Tab> options={tabs} value={tab} onChange={setTab} />
          <div className={styles.body}>
            {tab === 'profil' && t ? (
              <div className={styles.rows}>
                <Row k="Nom complet" v={t.nom} />
                <Row k="Matière" v={t.matiere} />
                <Row k="Téléphone" v={t.tel} />
                <Row k="E-mail" v={t.email} />
                <Row k="Statut" v={t.statut === 'actif' ? 'Actif' : 'En congé'} />
                <Row k="Classes" v={t.classes.join(', ') || 'Aucune'} />
              </div>
            ) : null}

            {tab === 'classes' ? (
              <>
                <p className={styles.hint}>
                  Les classes de cet enseignant se gèrent uniquement depuis cette liste — choisissez une classe existante de
                  l’établissement pour l’ajouter.
                </p>
                <div className={styles.classList}>
                  {(t?.classes ?? []).length === 0 ? (
                    <p className={styles.muted}>Aucune classe assignée pour le moment.</p>
                  ) : (
                    t?.classes.map((cn) => (
                      <div key={cn} className={styles.classRow}>
                        <strong>{cn}</strong>
                        <Button variant="ghost" size="sm" onClick={() => removeClassMutation.mutate(cn)}>
                          ✕ Retirer
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className={styles.addRow}>
                  <Select id="tc-add-select" value={classToAdd} onChange={(e) => setClassToAdd(e.target.value)}>
                    <option value="">— Choisir une classe —</option>
                    {availableClasses.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="secondary"
                    disabled={!classToAdd}
                    loading={addClassMutation.isPending}
                    onClick={() => addClassMutation.mutate(classToAdd)}
                  >
                    + Ajouter
                  </Button>
                </div>
              </>
            ) : null}

            {tab === 'documents' ? (
              <>
                <div className={styles.calHead}>
                  <h3 className={styles.sectionTitle}>Documents administratifs</h3>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/signatures')}>
                    🖊 Signer un document
                  </Button>
                </div>
                <StateView
                  loading={documents.isLoading}
                  error={documents.error}
                  empty={(documents.data?.length ?? 0) === 0}
                  emptyLabel="Aucun document signé pour cet enseignant pour le moment."
                >
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Série</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Signataire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.data?.map((d) => (
                        <tr key={d.serie}>
                          <td className={styles.mono}>{d.serie}</td>
                          <td>{d.type}</td>
                          <td className={styles.mono}>{d.date}</td>
                          <td>{d.signataire}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </StateView>

                <h3 className={styles.sectionTitle} style={{ marginTop: 'var(--space-lg)' }}>
                  Pièces personnelles
                </h3>
                <p className={styles.hint}>
                  CNI, diplôme, certification — distinct des documents administratifs signés ci-dessus.
                </p>
                <PersonalDocumentsSection ownerId={teacherId} ownerType="personnel" />
              </>
            ) : null}

            {tab === 'remuneration' && t ? <RemunerationTab teacherId={teacherId} teacher={t} /> : null}

            {tab === 'absences' ? <AbsencesTab teacherId={teacherId} /> : null}
          </div>
        </Card>
      </StateView>

      <TeacherFormSheet open={editOpen} onClose={() => setEditOpen(false)} teacher={t} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.muted}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

/**
 * Éditeur de salaire + historique des bulletins — un seul des trois montants
 * est pertinent selon `salaryMode` (même règle qu'`UpdateSalaryRequest`
 * côté backend) ; `teachers.updateSalary` revalide côté mock, mais on évite
 * déjà ici de soumettre les deux champs non pertinents.
 */
function RemunerationTab({ teacherId, teacher }: { teacherId: string; teacher: Teacher }) {
  const { teachers } = useServices();
  const queryClient = useQueryClient();

  const payslips = useQuery({ queryKey: ['teacher-payslips', teacherId], queryFn: () => teachers.listPayslips(teacherId) });

  const [mode, setMode] = useState<SalaryMode>(teacher.salaryMode ?? 'fixe');
  const [montant, setMontant] = useState<string>(
    String(teacher.salaireFixe ?? teacher.tauxJournalier ?? teacher.tauxHoraire ?? ''),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(teacher.salaryMode ?? 'fixe');
    setMontant(String(teacher.salaireFixe ?? teacher.tauxJournalier ?? teacher.tauxHoraire ?? ''));
  }, [teacher.salaryMode, teacher.salaireFixe, teacher.tauxJournalier, teacher.tauxHoraire]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const value = Number(montant);
      return teachers.updateSalary(teacherId, {
        salaryMode: mode,
        salaireFixe: mode === 'fixe' ? value : null,
        tauxJournalier: mode === 'par_jour' ? value : null,
        tauxHoraire: mode === 'par_heure' ? value : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', teacherId] });
      setError(null);
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Erreur inattendue.'),
  });

  const montantLabel = mode === 'fixe' ? 'Salaire mensuel fixe' : mode === 'par_jour' ? 'Taux journalier' : 'Taux horaire';

  return (
    <>
      <div className={styles.calHead}>
        <h3 className={styles.sectionTitle}>Salaire dans l’établissement</h3>
      </div>
      {!teacher.salaryMode ? (
        <p className={styles.hint}>
          Aucun salaire configuré pour le moment — une demande de paiement ne pourra pas être créée pour cet enseignant
          avant d’en définir un ci-dessous.
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
        <Field label="Mode de rémunération">
          <Select value={mode} onChange={(e) => setMode(e.target.value as SalaryMode)}>
            <option value="fixe">{SALARY_MODE_LABEL.fixe}</option>
            <option value="par_jour">{SALARY_MODE_LABEL.par_jour}</option>
            <option value="par_heure">{SALARY_MODE_LABEL.par_heure}</option>
          </Select>
        </Field>
        <Field label={`${montantLabel} (FCFA)`}>
          <Input type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} />
        </Field>
        <Button variant="primary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          Enregistrer
        </Button>
      </div>
      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: -4 }}>{error}</p> : null}

      <h3 className={styles.sectionTitle} style={{ marginTop: 'var(--space-lg)' }}>
        Historique des bulletins de paie
      </h3>
      <StateView
        loading={payslips.isLoading}
        error={payslips.error}
        empty={(payslips.data?.length ?? 0) === 0}
        emptyLabel="Aucun bulletin de paie disponible pour cet enseignant."
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Période</th>
              <th>Mode</th>
              <th>Jours/Heures</th>
              <th>Absences inj.</th>
              <th>Montant brut</th>
              <th>Payeur</th>
              <th>Généré le</th>
            </tr>
          </thead>
          <tbody>
            {payslips.data?.map((s) => (
              <tr key={s.id}>
                <td>{s.periode}</td>
                <td>{SALARY_MODE_LABEL[s.salaryMode]}</td>
                <td className={styles.mono}>{s.joursTravailles ?? s.heuresTravaillees ?? '—'}</td>
                <td className={styles.mono}>{s.joursAbsenceInjustifiee ?? '—'}</td>
                <td className={styles.mono}>{fmtXOF(s.montantBrut)}</td>
                <td>{s.payeurEtat ? 'État' : 'École'}</td>
                <td className={styles.mono}>{s.dateGeneration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </StateView>
    </>
  );
}

/** Absences du personnel, saisies par la direction — alimentent le calcul d'une demande de paiement en mode "par jour". */
function AbsencesTab({ teacherId }: { teacherId: string }) {
  const { staffAbsences } = useServices();
  const queryClient = useQueryClient();

  const absences = useQuery({ queryKey: ['teacher-absences', teacherId], queryFn: () => staffAbsences.list(teacherId) });

  const [dateDebut, setDateDebut] = useState(todayISO());
  const [dateFin, setDateFin] = useState(todayISO());
  const [justifiee, setJustifiee] = useState(false);
  const [motif, setMotif] = useState('');

  const recordMutation = useMutation({
    mutationFn: () =>
      staffAbsences.record(teacherId, {
        dateDebut: isoToFR(dateDebut),
        dateFin: isoToFR(dateFin),
        justifiee,
        motif: motif.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-absences', teacherId] });
      setMotif('');
      setJustifiee(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (absenceId: string) => staffAbsences.remove(absenceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teacher-absences', teacherId] }),
  });

  return (
    <>
      <div className={styles.calHead}>
        <h3 className={styles.sectionTitle}>Enregistrer une absence</h3>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
        <Field label="Du">
          <DateInput value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
        </Field>
        <Field label="Au">
          <DateInput value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
        </Field>
        <Field label="Justifiée">
          <Select value={justifiee ? 'oui' : 'non'} onChange={(e) => setJustifiee(e.target.value === 'oui')}>
            <option value="non">Non justifiée</option>
            <option value="oui">Justifiée</option>
          </Select>
        </Field>
        <Field label="Motif (optionnel)">
          <Textarea rows={1} value={motif} onChange={(e) => setMotif(e.target.value)} />
        </Field>
        <Button variant="primary" loading={recordMutation.isPending} onClick={() => recordMutation.mutate()}>
          Enregistrer
        </Button>
      </div>

      <h3 className={styles.sectionTitle}>Absences enregistrées</h3>
      <StateView
        loading={absences.isLoading}
        error={absences.error}
        empty={(absences.data?.length ?? 0) === 0}
        emptyLabel="Aucune absence enregistrée pour cet enseignant."
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Du</th>
              <th>Au</th>
              <th>Statut</th>
              <th>Motif</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {absences.data?.map((a) => (
              <tr key={a.id}>
                <td className={styles.mono}>{a.dateDebut}</td>
                <td className={styles.mono}>{a.dateFin}</td>
                <td>
                  <Badge tone={a.justifiee ? 'success' : 'warning'}>{a.justifiee ? 'Justifiée' : 'Non justifiée'}</Badge>
                </td>
                <td>{a.motif ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(a.id)}>
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </StateView>
    </>
  );
}
