import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, DateInput, Field, Input, Segmented, Select, Sheet, StateView, Textarea } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { buildDownloadFilename, fmtXOF, isoToFR, todayISO } from '@/utils/format';
import type { SalaryMode, SignedDocument, StaffStatus, Teacher } from '@/types/domain';
import { PersonalDocumentsSection } from '@/components/documents/PersonalDocumentsSection';
import { TeacherFormSheet } from './TeacherFormSheet';
import styles from './TeacherDetailPage.module.css';

const STATUT_LABEL: Record<StaffStatus, string> = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  transfere: 'Transféré',
  en_attente: 'En attente d’activation',
};

type Tab = 'profil' | 'classes' | 'documents' | 'remuneration' | 'absences';

const SALARY_MODE_LABEL: Record<SalaryMode, string> = {
  fixe: 'Fixe (mensuel)',
  par_jour: 'Par jour travaillé',
  par_heure: 'Par heure',
};

export default function TeacherDetailPage() {
  const { teacherId = '' } = useParams();
  const navigate = useNavigate();
  const { teachers, classes, subjects } = useServices();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('profil');
  const [editOpen, setEditOpen] = useState(false);
  const [classToAdd, setClassToAdd] = useState('');

  const teacherQuery = useQuery({ queryKey: ['teacher', teacherId], queryFn: () => teachers.get(teacherId) });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const subjectList = useQuery({ queryKey: ['subjects'], queryFn: () => subjects.list() });
  const documents = useQuery({
    queryKey: ['teacher-documents', teacherId],
    queryFn: () => teachers.listDocuments(teacherId),
    enabled: tab === 'documents',
  });

  const t = teacherQuery.data;

  const addClassMutation = useMutation({
    mutationFn: (classId: string) => teachers.addClass(teacherId, classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', teacherId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setClassToAdd('');
    },
  });
  const removeClassMutation = useMutation({
    mutationFn: (classId: string) => teachers.removeClass(teacherId, classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', teacherId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const availableClasses = (classList.data ?? []).filter((c) => !(t?.classes ?? []).includes(c.name));
  // `Teacher.classes` ne porte que des noms (voir son commentaire) — on
  // résout l'id de classe nécessaire aux routes `class-service` via la
  // liste complète des classes de l'école.
  const classIdByName = new Map((classList.data ?? []).map((c) => [c.name, c.id]));

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
        subtitle={t ? `${(subjectNames(t.subjectIds, subjectList.data)) || 'Aucune matière'} · ${t.classes.join(', ') || 'Aucune classe'}` : undefined}
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
                <Row k="Matières" v={subjectNames(t.subjectIds, subjectList.data) || '—'} />
                <Row k="Téléphone" v={t.tel} />
                <Row k="E-mail" v={t.email} />
                <Row k="Statut" v={STATUT_LABEL[t.statut]} />
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
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={removeClassMutation.isPending && removeClassMutation.variables === classIdByName.get(cn)}
                          onClick={() => {
                            const classId = classIdByName.get(cn);
                            if (classId) removeClassMutation.mutate(classId);
                          }}
                        >
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
                      <option key={c.id} value={c.id}>
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

/** Résout des ids `Subject` en noms affichables, dans l'ordre fourni. */
function subjectNames(subjectIds: string[], allSubjects: { id: string; nom: string }[] | undefined): string {
  if (!allSubjects) return '';
  const byId = new Map(allSubjects.map((sub) => [sub.id, sub.nom]));
  return subjectIds.map((id) => byId.get(id) ?? id).join(', ');
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
  const { teachers, signatures } = useServices();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const payslips = useQuery({ queryKey: ['teacher-payslips', teacherId], queryFn: () => teachers.listPayslips(teacherId) });

  // Signer/cacheter un bulletin de paie (demande explicite) -- même modèle
  // que AcademicResultsPage pour les bulletins scolaires : tampon/signature
  // du signataire requis au préalable (bouton grisé sinon), Signer et
  // Cacheter indépendants l'un de l'autre.
  const assetsQuery = useQuery({ queryKey: ['signer-assets'], queryFn: () => signatures.getMyAssets() });
  const hasSignature = assetsQuery.data?.hasSignature ?? false;
  const hasStamp = assetsQuery.data?.hasStamp ?? false;
  const [assetDialog, setAssetDialog] = useState<'signature' | 'stamp' | null>(null);
  function requireAsset(kind: 'signature' | 'stamp', ok: boolean, run: () => void) {
    if (!ok) {
      setAssetDialog(kind);
      return;
    }
    run();
  }

  // `documentRef` est le `payslipId` (pas le `teacherId`) -- voir le
  // doc-comment de `SignaturesPort.signPayslip` : un même enseignant a
  // plusieurs bulletins de paie, chacun signé indépendamment.
  const signedDocumentsQuery = useQuery({ queryKey: ['signed-documents'], queryFn: () => signatures.listDocuments() });
  const payslipDocuments = (signedDocumentsQuery.data ?? []).filter(
    (d) => d.type === 'Bulletin de paie' && d.documentRef,
  );
  const signedByPayslipId = new Map(
    payslipDocuments.filter((d) => d.action !== 'CACHET').map((d) => [d.documentRef as string, d]),
  );
  const cachetedByPayslipId = new Map(
    payslipDocuments.filter((d) => d.action === 'CACHET').map((d) => [d.documentRef as string, d]),
  );
  function invalidateSignedPayslips() {
    queryClient.invalidateQueries({ queryKey: ['signed-documents'] });
  }
  const signPayslipMutation = useMutation({
    mutationFn: (payslipId: string) => signatures.signPayslip(payslipId, teacherId, 'SIGNATURE'),
    onSuccess: invalidateSignedPayslips,
  });
  const cachetPayslipMutation = useMutation({
    mutationFn: (payslipId: string) => signatures.signPayslip(payslipId, teacherId, 'CACHET'),
    onSuccess: invalidateSignedPayslips,
  });
  const [teacherFirstName, ...teacherLastNameParts] = teacher.nom.trim().split(/\s+/);
  const downloadSignedPayslipMutation = useMutation({
    mutationFn: (doc: SignedDocument) =>
      signatures.downloadDocument(
        doc.signatureHash ?? '',
        buildDownloadFilename('fiche-de-paie', teacherFirstName ?? '', teacherLastNameParts.join(' ')),
      ),
  });

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
              <th>Signature</th>
              <th>Cachet</th>
            </tr>
          </thead>
          <tbody>
            {payslips.data?.map((s) => {
              const signedDoc = signedByPayslipId.get(s.id);
              const cachetedDoc = cachetedByPayslipId.get(s.id);
              return (
                <tr key={s.id}>
                  <td>{s.periode}</td>
                  <td>{SALARY_MODE_LABEL[s.salaryMode]}</td>
                  <td className={styles.mono}>{s.joursTravailles ?? s.heuresTravaillees ?? '—'}</td>
                  <td className={styles.mono}>{s.joursAbsenceInjustifiee ?? '—'}</td>
                  <td className={styles.mono}>{fmtXOF(s.montantBrut)}</td>
                  <td>{s.payeurEtat ? 'État' : 'École'}</td>
                  <td className={styles.mono}>{s.dateGeneration}</td>
                  <td>
                    {signedDoc ? (
                      signedDoc.signatureHash ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={downloadSignedPayslipMutation.isPending && downloadSignedPayslipMutation.variables === signedDoc}
                          onClick={() => downloadSignedPayslipMutation.mutate(signedDoc)}
                        >
                          ✅ Signé — télécharger
                        </Button>
                      ) : (
                        <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Signé — lien indisponible</span>
                      )
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={signPayslipMutation.isPending && signPayslipMutation.variables === s.id}
                        style={!hasSignature ? { opacity: 0.5 } : undefined}
                        aria-disabled={!hasSignature || undefined}
                        onClick={() => requireAsset('signature', hasSignature, () => signPayslipMutation.mutate(s.id))}
                      >
                        Signer
                      </Button>
                    )}
                  </td>
                  <td>
                    {cachetedDoc ? (
                      cachetedDoc.signatureHash ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={downloadSignedPayslipMutation.isPending && downloadSignedPayslipMutation.variables === cachetedDoc}
                          onClick={() => downloadSignedPayslipMutation.mutate(cachetedDoc)}
                        >
                          ✅ Cacheté — télécharger
                        </Button>
                      ) : (
                        <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Cacheté — lien indisponible</span>
                      )
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={cachetPayslipMutation.isPending && cachetPayslipMutation.variables === s.id}
                        style={!hasStamp ? { opacity: 0.5 } : undefined}
                        aria-disabled={!hasStamp || undefined}
                        onClick={() => requireAsset('stamp', hasStamp, () => cachetPayslipMutation.mutate(s.id))}
                      >
                        Cacheter
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </StateView>

      <Sheet
        title={assetDialog === 'stamp' ? 'Aucun tampon déposé' : 'Aucune signature déposée'}
        open={assetDialog !== null}
        onClose={() => setAssetDialog(null)}
      >
        <p>
          {assetDialog === 'stamp'
            ? "Aucun tampon n'est enregistré pour votre compte — vous ne pouvez pas cacheter de bulletin de paie tant qu'il n'est pas déposé."
            : "Aucune signature n'est enregistrée pour votre compte — vous ne pouvez pas signer de bulletin de paie tant qu'elle n'est pas déposée."}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Button
            variant="primary"
            onClick={() => {
              setAssetDialog(null);
              navigate('/parametres');
            }}
          >
            Aller dans Paramètres
          </Button>
          <Button variant="secondary" onClick={() => setAssetDialog(null)}>
            Fermer
          </Button>
        </div>
      </Sheet>
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
