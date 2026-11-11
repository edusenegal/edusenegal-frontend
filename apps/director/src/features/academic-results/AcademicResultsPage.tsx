import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Input, Segmented, Select, Sheet, StateView, Textarea } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { BulletinPeriod, Mention, PromotionOverride, PromotionResult, SemesterResult, SignedDocument, YearResult } from '@/types/domain';
import { buildDownloadFilename } from '@/utils/format';

/** Nom de fichier lisible à partir du nom affiché ("Prénom Nom") -- voir `SignaturesPort.downloadDocument`. */
function buildSignedFilename(d: SignedDocument): string {
  const [first, ...rest] = d.cible.trim().split(/\s+/);
  return buildDownloadFilename((d.type ?? 'document').toLowerCase(), first ?? '', rest.join(' '));
}

const MENTION_LABELS: Record<Mention, string> = {
  excellent: 'Excellent',
  tres_bien: 'Très bien',
  bien: 'Bien',
  assez_bien: 'Assez bien',
  passable: 'Passable',
  insuffisant: 'Insuffisant',
};

const MENTION_TONES: Record<Mention, BadgeTone> = {
  excellent: 'success',
  tres_bien: 'success',
  bien: 'success',
  assez_bien: 'info',
  passable: 'warning',
  insuffisant: 'danger',
};

const DECISION_LABELS: Record<PromotionResult, string> = {
  admis: 'Admis(e)',
  admis_exceptionnel: 'Admis(e) à titre exceptionnel',
  redouble: 'Redouble',
  exclu: 'Exclu(e)',
};

const DECISION_TONES: Record<PromotionResult, BadgeTone> = {
  admis: 'success',
  admis_exceptionnel: 'info',
  redouble: 'warning',
  exclu: 'danger',
};

/**
 * Résultats & bulletins — pilotage uniquement (verrouiller, calculer,
 * publier, générer, consulter). La saisie de note est un acte enseignant et
 * n'a volontairement pas d'écran ici — voir le doc-comment d'
 * `AcademicResultsPort`. Repose exclusivement sur `academic-service` : le
 * système d'export générique de `report-service` (stats école, rapport
 * paiements) est hors scope de cet écran.
 */
export default function AcademicResultsPage() {
  const { classes, subjects, academicResults, signatures } = useServices();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  // CORRECTION (demande explicite) : Signer et Cacheter restent possibles
  // côté backend sans tampon/signature déposés (Signer réussirait même
  // sans image -- voir SignatureServiceImpl), mais la direction veut les
  // deux boutons grisés tant que les DEUX images ne sont pas déposées,
  // comme règle interne. Même requête que SettingsPage (`signer-assets`) :
  // partagée en cache, pas de double appel en changeant d'écran.
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

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => subjects.list() });
  const [classId, setClassId] = useState<string>('');
  useEffect(() => {
    if (!classId && classesQuery.data?.length) setClassId(classesQuery.data[0]!.id);
  }, [classId, classesQuery.data]);

  const configQuery = useQuery({
    queryKey: ['academic-config', classId],
    queryFn: () => academicResults.getEffectiveConfig(classId),
    enabled: Boolean(classId),
  });
  const config = configQuery.data;

  // Verrouillage : le backend n'expose que l'action (PUT .../lock), jamais
  // une lecture de l'état verrouillé — ce `Set` ne reflète donc que les
  // verrouillages faits depuis l'ouverture de cet écran, pas un état
  // persistant relu au chargement (fidèle à ce que l'API réelle permet).
  const [lockedThisSession, setLockedThisSession] = useState<Set<string>>(new Set());
  const [subjectToLock, setSubjectToLock] = useState<string>('');
  const classSubjects = (subjectsQuery.data ?? []).filter((s) =>
    s.coefficients.some((c) => c.classeId === classId && c.enseignee),
  );
  useEffect(() => {
    if (classSubjects.length && !classSubjects.some((s) => s.id === subjectToLock)) {
      setSubjectToLock(classSubjects[0]!.id);
    }
  }, [classSubjects, subjectToLock]);

  const [editingConfig, setEditingConfig] = useState(false);
  const [d1Weight, setD1Weight] = useState(1);
  const [d2Weight, setD2Weight] = useState(1);
  const [compositionWeight, setCompositionWeight] = useState(2);
  const [minPassAverage, setMinPassAverage] = useState(10);
  useEffect(() => {
    if (!config) return;
    setD1Weight(config.d1Weight);
    setD2Weight(config.d2Weight);
    setCompositionWeight(config.compositionWeight);
    setMinPassAverage(config.minPassAverage);
  }, [config?.id]);

  const [scope, setScope] = useState<'semestre' | 'annuel'>('semestre');
  const [semesterNumber, setSemesterNumber] = useState(1);

  const resultsQuery = useQuery({
    queryKey: ['semester-results', classId, semesterNumber],
    queryFn: () => academicResults.getClassSemesterResults(classId, semesterNumber),
    enabled: Boolean(classId) && scope === 'semestre',
  });

  const yearResultsQuery = useQuery({
    queryKey: ['year-results', classId],
    queryFn: () => academicResults.getClassYearResults(classId),
    enabled: Boolean(classId) && scope === 'annuel',
  });

  // État de verrouillage PERSISTANT (relu du backend) + verrouillages faits
  // dans cette session — une matière verrouillée n'est plus saisissable ni
  // modifiable par l'enseignant (vérifié côté backend sur chaque note).
  const lockedSubjectsQuery = useQuery({
    queryKey: ['locked-subjects', classId, semesterNumber],
    queryFn: () => academicResults.getLockedSubjects(classId, semesterNumber),
    enabled: Boolean(classId) && scope === 'semestre',
  });
  const lockedKeys = useMemo(() => {
    const set = new Set<string>(lockedThisSession);
    for (const sid of lockedSubjectsQuery.data ?? []) set.add(`${sid}|${semesterNumber}`);
    return set;
  }, [lockedSubjectsQuery.data, lockedThisSession, semesterNumber]);
  const isSubjectLocked = (sid: string) => lockedKeys.has(`${sid}|${semesterNumber}`);

  function invalidateResults() {
    queryClient.invalidateQueries({ queryKey: ['semester-results', classId, semesterNumber] });
    queryClient.invalidateQueries({ queryKey: ['year-results', classId] });
  }

  function runMutation<T>(fn: () => Promise<T>, onSuccess?: (result: T) => void) {
    setError(null);
    fn()
      .then((result) => {
        invalidateResults();
        onSuccess?.(result);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."));
  }

  const lockMutation = useMutation({
    mutationFn: (subjectId: string) => academicResults.lockGrades(classId, subjectId, semesterNumber),
  });
  const configureMutation = useMutation({
    mutationFn: () =>
      academicResults.configure({
        classId,
        periodType: config?.periodType ?? 'semestre',
        semesterCount: config?.semesterCount ?? 2,
        periods: config?.periods ?? [],
        d1Weight,
        d2Weight,
        compositionWeight,
        minPassAverage,
      }),
  });
  const computeAveragesMutation = useMutation({
    mutationFn: () => academicResults.computeClassAverages(classId, semesterNumber),
  });
  const computeResultsMutation = useMutation({
    mutationFn: () => academicResults.computeClassResults(classId, semesterNumber),
  });
  const publishMutation = useMutation({
    mutationFn: () => academicResults.publishResults(classId, semesterNumber),
  });
  const generateClassBulletinsMutation = useMutation({
    mutationFn: () => academicResults.generateClassBulletins(classId, semesterNumber),
  });
  const generateOneBulletinMutation = useMutation({
    mutationFn: (studentId: string) => academicResults.generateStudentBulletin(studentId, semesterNumber),
  });
  const downloadMutation = useMutation({
    mutationFn: (studentId: string) => academicResults.downloadBulletinPdf(studentId, semesterNumber),
  });

  // CORRECTION (bug signalé) : téléchargement d'un bulletin signé/cacheté —
  // fetch + téléchargement local (comme downloadMutation ci-dessus), plutôt
  // qu'un lien direct cassé vers `downloadUrl`.
  const downloadSignedMutation = useMutation({
    mutationFn: (d: SignedDocument) => signatures.downloadDocument(d.signatureHash ?? '', buildSignedFilename(d)),
  });
  // Signature des bulletins (task #256, réutilisé ici) -- un seul appel
  // `/school/me` donne, pour TOUS les documents signés de l'école, de quoi
  // savoir SANS appel par élève si LE bulletin de CE semestre est déjà
  // signé pour chaque élève de la classe (filtré ci-dessous par
  // `documentRef`/`semesterNumber`), et offre directement le lien de
  // téléchargement du PDF signé (présigné MinIO) une fois signé.
  const signedBulletinsQuery = useQuery({
    queryKey: ['signed-bulletins'],
    queryFn: () => signatures.listDocuments(),
    enabled: scope === 'semestre',
  });
  const bulletinsForPeriod = (signedBulletinsQuery.data ?? []).filter(
    (d) => d.cibleKind === 'eleve' && (d.type ?? '').startsWith('Bulletin') && d.semesterNumber === semesterNumber && Boolean(d.documentRef),
  );
  // CACHET et SIGNATURE sont deux actions indépendantes (voir SignatureAction
  // côté backend) : un même bulletin peut avoir l'une, l'autre, les deux, ou
  // aucune -- deux cartes séparées, pas une seule. `action` absent/`null`
  // (document antérieur à cette distinction) est traité comme SIGNATURE.
  const signedBulletinByStudent = new Map(
    bulletinsForPeriod.filter((d) => d.action !== 'CACHET').map((d) => [d.documentRef as string, d]),
  );
  const cachetedBulletinByStudent = new Map(
    bulletinsForPeriod.filter((d) => d.action === 'CACHET').map((d) => [d.documentRef as string, d]),
  );
  function invalidateSignedBulletins() {
    queryClient.invalidateQueries({ queryKey: ['signed-bulletins'] });
  }
  // CORRECTION (signalé) — « je veux avoir une rubrique signer/cacheter qui
  // permet à la fois de signer et cacheter » : une seule action, au lieu de
  // deux boutons séparés. SIGNATURE et CACHET restent deux appels
  // indépendants côté backend (SignatureAction), mais chacun ne refait que
  // ce qui manque encore pour ce document — rejouer l'action sur un
  // document déjà signé-et-cacheté ne fait donc rien d'inutile.
  const signAndCachetMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const period = `t${semesterNumber}` as BulletinPeriod['key'];
      if (!signedBulletinByStudent.has(studentId)) {
        await signatures.signForStudent(studentId, 'Bulletin', period, 'SIGNATURE');
      }
      if (!cachetedBulletinByStudent.has(studentId)) {
        await signatures.signForStudent(studentId, 'Bulletin', period, 'CACHET');
      }
    },
    onSuccess: invalidateSignedBulletins,
  });
  const signAndCachetClassBulletinsMutation = useMutation({
    mutationFn: async () => {
      const period = `t${semesterNumber}` as BulletinPeriod['key'];
      const [sign, cachet] = await Promise.all([
        signatures.signBulk(classId, period, 'SIGNATURE'),
        signatures.signBulk(classId, period, 'CACHET'),
      ]);
      return { signed: sign.signed, cacheted: cachet.signed };
    },
    onSuccess: invalidateSignedBulletins,
  });
  const closeYearMutation = useMutation({
    mutationFn: (overrides: PromotionOverride[]) => academicResults.closeResultsYear(overrides),
  });

  // task #234 : avant de clôturer, on balaie TOUTES les classes (pas
  // seulement celle affichée) pour repérer les moyennes annuelles sous la
  // moyenne de passage — ce sont elles que le directeur peut faire passer
  // à titre exceptionnel, décision par décision.
  const [closeSheetOpen, setCloseSheetOpen] = useState(false);
  const [atRiskLoading, setAtRiskLoading] = useState(false);
  const [atRisk, setAtRisk] = useState<(YearResult & { className: string })[]>([]);
  const [exceptionalDrafts, setExceptionalDrafts] = useState<Record<string, { checked: boolean; note: string }>>({});

  async function openCloseSheet() {
    setError(null);
    setCloseSheetOpen(true);
    setAtRiskLoading(true);
    try {
      const allClasses = classesQuery.data ?? [];
      const perClass = await Promise.all(
        allClasses.map((c) =>
          academicResults
            .getClassYearResults(c.id)
            .then((rows) => rows.map((row) => ({ ...row, className: c.name }))),
        ),
      );
      const belowPassAverage = perClass.flat().filter((row) => row.decision === 'redouble');
      setAtRisk(belowPassAverage);
      setExceptionalDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de vérifier les moyennes annuelles.");
      setCloseSheetOpen(false);
    } finally {
      setAtRiskLoading(false);
    }
  }

  function closeCloseSheet() {
    setCloseSheetOpen(false);
    setAtRisk([]);
    setExceptionalDrafts({});
  }

  function onConfirmCloseYear() {
    const overrides: PromotionOverride[] = atRisk
      .filter((row) => exceptionalDrafts[row.studentId]?.checked)
      .map((row) => ({
        studentId: row.studentId,
        classId: row.classId,
        moyenneAnnuelle: row.moyenneAnnuelle,
        decision: 'admis_exceptionnel',
        note: exceptionalDrafts[row.studentId]?.note ?? '',
      }));
    runMutation(
      () => closeYearMutation.mutateAsync(overrides),
      () => closeCloseSheet(),
    );
  }

  const results = resultsQuery.data ?? [];
  const yearResults = yearResultsQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Résultats & bulletins"
        subtitle="Verrouillage des notes, calcul des moyennes et résultats, publication, génération des bulletins."
      />

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'end' }}>
        <Field label="Classe">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ minWidth: 200 }}>
            {(classesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Segmented<'semestre' | 'annuel'>
          options={[
            { value: 'semestre', label: 'Par semestre' },
            { value: 'annuel', label: 'Bilan annuel' },
          ]}
          value={scope}
          onChange={setScope}
        />
        {scope === 'semestre' ? (
          <Segmented
            options={Array.from({ length: config?.semesterCount ?? 2 }, (_, i) => ({
              value: String(i + 1),
              label: `Semestre ${i + 1}`,
            }))}
            value={String(semesterNumber)}
            onChange={(v) => setSemesterNumber(Number(v))}
          />
        ) : null}
      </div>

      <StateView loading={!classId || configQuery.isLoading} error={classesQuery.error ?? configQuery.error}>
        <Card padded style={{ marginBottom: 20 }}>
          <CardHeader
            title="Configuration académique"
            action={
              <Button variant="secondary" onClick={() => setEditingConfig((v) => !v)}>
                {editingConfig ? 'Annuler' : 'Modifier'}
              </Button>
            }
          />
          {editingConfig ? (
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <Field label="Poids D1">
                <Input type="number" min={0} value={d1Weight} onChange={(e) => setD1Weight(Math.max(0, Number(e.target.value) || 0))} style={{ width: 90 }} />
              </Field>
              <Field label="Poids D2">
                <Input type="number" min={0} value={d2Weight} onChange={(e) => setD2Weight(Math.max(0, Number(e.target.value) || 0))} style={{ width: 90 }} />
              </Field>
              <Field label="Poids Composition">
                <Input type="number" min={0} value={compositionWeight} onChange={(e) => setCompositionWeight(Math.max(0, Number(e.target.value) || 0))} style={{ width: 90 }} />
              </Field>
              <Field label="Moyenne de passage /20">
                <Input type="number" min={0} max={20} value={minPassAverage} onChange={(e) => setMinPassAverage(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} style={{ width: 90 }} />
              </Field>
              <Button
                variant="primary"
                loading={configureMutation.isPending}
                onClick={() =>
                  runMutation(() => configureMutation.mutateAsync(), () => {
                    setEditingConfig(false);
                    queryClient.invalidateQueries({ queryKey: ['academic-config', classId] });
                  })
                }
              >
                Enregistrer
              </Button>
            </div>
          ) : config ? (
            <div style={{ marginTop: 10, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              <span><strong>{config.semesterCount}</strong> semestre(s)</span>
              <span>Pondération D1/D2/Composition : <strong>{config.d1Weight}/{config.d2Weight}/{config.compositionWeight}</strong></span>
              <span>Moyenne de passage : <strong>{config.minPassAverage}/20</strong></span>
              <span style={{ color: 'var(--color-text-muted)' }}>Mise à jour le {config.updatedAt}</span>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Aucune configuration pour cette classe — les valeurs par défaut (2 semestres, pondération 1/1/2, moyenne de
              passage 10/20) seront utilisées.
            </p>
          )}
        </Card>

        {scope === 'semestre' ? (
          <Card padded style={{ marginBottom: 20 }}>
            <CardHeader title="Verrouillage des notes" />
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '4px 0 12px' }}>
              Verrouille les notes d'une matière pour ce semestre — préalable au calcul des moyennes. Une fois
              verrouillée, l'enseignant ne peut plus saisir ni modifier aucune note de cette matière pour ce semestre.
              Les matières déjà verrouillées sont indiquées ci-dessous.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
              <Field label="Matière">
                <Select value={subjectToLock} onChange={(e) => setSubjectToLock(e.target.value)} style={{ minWidth: 220 }}>
                  {classSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                      {isSubjectLocked(s.id) ? ' — verrouillée' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                variant="secondary"
                disabled={!subjectToLock || isSubjectLocked(subjectToLock)}
                loading={lockMutation.isPending}
                onClick={() =>
                  runMutation(() => lockMutation.mutateAsync(subjectToLock), () => {
                    setLockedThisSession((prev) => new Set(prev).add(`${subjectToLock}|${semesterNumber}`));
                    queryClient.invalidateQueries({ queryKey: ['locked-subjects', classId, semesterNumber] });
                  })
                }
              >
                Verrouiller
              </Button>
              {isSubjectLocked(subjectToLock) ? <Badge tone="success">🔒 Déjà verrouillée</Badge> : null}
            </div>
            {classSubjects.some((sub) => isSubjectLocked(sub.id)) ? (
              <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Matières verrouillées :</span>
                {classSubjects
                  .filter((sub) => isSubjectLocked(sub.id))
                  .map((sub) => (
                    <Badge key={sub.id} tone="neutral">🔒 {sub.nom}</Badge>
                  ))}
              </div>
            ) : null}
          </Card>
        ) : null}

        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 16 }}>{error}</p> : null}

        {scope === 'semestre' ? (
          <>
            <Card padded style={{ marginBottom: 20 }}>
              <CardHeader title="Calcul & publication" />
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  loading={computeAveragesMutation.isPending}
                  onClick={() => runMutation(() => computeAveragesMutation.mutateAsync())}
                >
                  1. Calculer les moyennes
                </Button>
                <Button
                  variant="secondary"
                  loading={computeResultsMutation.isPending}
                  onClick={() => runMutation(() => computeResultsMutation.mutateAsync())}
                >
                  2. Calculer les résultats
                </Button>
                <Button
                  variant="primary"
                  loading={publishMutation.isPending}
                  disabled={results.length === 0}
                  onClick={() => runMutation(() => publishMutation.mutateAsync())}
                >
                  3. Publier les résultats
                </Button>
                <Button
                  variant="secondary"
                  loading={generateClassBulletinsMutation.isPending}
                  disabled={results.length === 0}
                  onClick={() => runMutation(() => generateClassBulletinsMutation.mutateAsync())}
                >
                  Générer tous les bulletins de la classe
                </Button>
                <Button
                  variant="secondary"
                  loading={signAndCachetClassBulletinsMutation.isPending}
                  disabled={!results.some((r) => r.bulletinGenere)}
                  style={!hasSignature || !hasStamp ? { opacity: 0.5 } : undefined}
                  aria-disabled={!hasSignature || !hasStamp || undefined}
                  onClick={() =>
                    requireAsset('signature', hasSignature, () =>
                      requireAsset('stamp', hasStamp, () =>
                        runMutation(() => signAndCachetClassBulletinsMutation.mutateAsync()),
                      ),
                    )
                  }
                >
                  Signer &amp; cacheter tous les bulletins de la classe
                </Button>
              </div>
            </Card>

            <Card padded>
              <CardHeader title={`Résultats — Semestre ${semesterNumber}`} />
              {resultsQuery.isLoading ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>Chargement…</p>
              ) : results.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  Aucun résultat calculé pour ce semestre — lancez le calcul ci-dessus.
                </p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                        <th style={{ padding: '6px 8px 6px 0' }}>Rang</th>
                        <th style={{ padding: '6px 8px' }}>Élève</th>
                        <th style={{ padding: '6px 8px' }} />
                        <th style={{ padding: '6px 8px' }}>Moyenne</th>
                        <th style={{ padding: '6px 8px' }}>Mention</th>
                        <th style={{ padding: '6px 8px' }}>Bulletin</th>
                        <th style={{ padding: '6px 8px' }}>Publié</th>
                        <th style={{ padding: '6px 8px' }}>Signature</th>
                        <th style={{ padding: '6px 8px' }}>Cachet</th>
                        <th style={{ padding: '6px 8px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row: SemesterResult) => (
                        <tr key={row.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px 8px 8px 0', fontWeight: 600 }}>{row.rangClasse}</td>
                          <td style={{ padding: 8 }}>{row.studentNom}</td>
                          <td style={{ padding: 8 }}>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/resultats/eleve/${row.studentId}`)}>
                              Détails
                            </Button>
                          </td>
                          <td style={{ padding: 8, fontWeight: 600 }}>{row.moyenneGenerale.toFixed(2)}/20</td>
                          <td style={{ padding: 8 }}>
                            <Badge tone={MENTION_TONES[row.mention]}>{MENTION_LABELS[row.mention]}</Badge>
                          </td>
                          <td style={{ padding: 8 }}>{row.bulletinGenere ? '✅' : '—'}</td>
                          <td style={{ padding: 8 }}>{row.publie ? '✅' : '—'}</td>
                          <td style={{ padding: 8 }}>{signedBulletinByStudent.has(row.studentId) ? '✅' : '—'}</td>
                          <td style={{ padding: 8 }}>{cachetedBulletinByStudent.has(row.studentId) ? '✅' : '—'}</td>
                          <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                            {!row.bulletinGenere ? (
                              <Button
                                variant="secondary"
                                loading={generateOneBulletinMutation.isPending && generateOneBulletinMutation.variables === row.studentId}
                                onClick={() => runMutation(() => generateOneBulletinMutation.mutateAsync(row.studentId))}
                              >
                                Générer
                              </Button>
                            ) : (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Button
                                  variant="secondary"
                                  loading={downloadMutation.isPending && downloadMutation.variables === row.studentId}
                                  onClick={() => runMutation(() => downloadMutation.mutateAsync(row.studentId))}
                                >
                                  Télécharger
                                </Button>
                                {signedBulletinByStudent.has(row.studentId) ? (
                                  (() => {
                                    const doc = signedBulletinByStudent.get(row.studentId);
                                    return doc?.signatureHash ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        loading={downloadSignedMutation.isPending && downloadSignedMutation.variables === doc}
                                        onClick={() => downloadSignedMutation.mutate(doc)}
                                      >
                                        ✅ Signé — télécharger
                                      </Button>
                                    ) : (
                                      <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Signé — lien indisponible</span>
                                    );
                                  })()
                                ) : null}
                                {cachetedBulletinByStudent.has(row.studentId) ? (
                                  (() => {
                                    const doc = cachetedBulletinByStudent.get(row.studentId);
                                    return doc?.signatureHash ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        loading={downloadSignedMutation.isPending && downloadSignedMutation.variables === doc}
                                        onClick={() => downloadSignedMutation.mutate(doc)}
                                      >
                                        ✅ Cacheté — télécharger
                                      </Button>
                                    ) : (
                                      <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Cacheté — lien indisponible</span>
                                    );
                                  })()
                                ) : null}
                                {/*
                                  CORRECTION (signalé) — « je veux avoir une rubrique
                                  signer/cacheter qui permet à la fois de signer et
                                  cacheter » : un seul bouton tant que l'une des deux
                                  actions manque (il ne refait que ce qui manque,
                                  voir signAndCachetMutation), plutôt que deux boutons
                                  "Signer"/"Cacheter" séparés.
                                */}
                                {!signedBulletinByStudent.has(row.studentId) || !cachetedBulletinByStudent.has(row.studentId) ? (
                                  <Button
                                    variant="secondary"
                                    loading={signAndCachetMutation.isPending && signAndCachetMutation.variables === row.studentId}
                                    style={!hasSignature || !hasStamp ? { opacity: 0.5 } : undefined}
                                    aria-disabled={!hasSignature || !hasStamp || undefined}
                                    onClick={() =>
                                      requireAsset('signature', hasSignature, () =>
                                        requireAsset('stamp', hasStamp, () =>
                                          runMutation(() => signAndCachetMutation.mutateAsync(row.studentId)),
                                        ),
                                      )
                                    }
                                  >
                                    Signer &amp; cacheter
                                  </Button>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        ) : (
          <Card padded>
            <CardHeader title="Bilan annuel" />
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <Button variant="primary" onClick={openCloseSheet}>
                Clôturer les résultats de l'année
              </Button>
            </div>
            {yearResultsQuery.isLoading ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Chargement…</p>
            ) : yearResults.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Aucun résultat annuel disponible.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                      <th style={{ padding: '6px 8px 6px 0' }}>Rang</th>
                      <th style={{ padding: '6px 8px' }}>Élève</th>
                      <th style={{ padding: '6px 8px' }}>Moyenne annuelle</th>
                      <th style={{ padding: '6px 8px' }}>Mention</th>
                      <th style={{ padding: '6px 8px' }}>Décision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearResults.map((row: YearResult) => (
                      <tr key={row.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 8px 8px 0', fontWeight: 600 }}>{row.rangClasse}</td>
                        <td style={{ padding: 8 }}>{row.studentNom}</td>
                        <td style={{ padding: 8, fontWeight: 600 }}>{row.moyenneAnnuelle.toFixed(2)}/20</td>
                        <td style={{ padding: 8 }}>
                          <Badge tone={MENTION_TONES[row.mention]}>{MENTION_LABELS[row.mention]}</Badge>
                        </td>
                        <td style={{ padding: 8 }}>
                          <Badge tone={DECISION_TONES[row.decision]}>{DECISION_LABELS[row.decision]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </StateView>

      <Sheet
        title="Clôturer les résultats de l'année"
        open={closeSheetOpen}
        onClose={closeCloseSheet}
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeCloseSheet}>
              Annuler
            </Button>
            <Button
              variant="primary"
              loading={closeYearMutation.isPending}
              disabled={atRiskLoading}
              onClick={onConfirmCloseYear}
            >
              Clôturer l'année
            </Button>
          </>
        }
      >
        {atRiskLoading ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Vérification des moyennes annuelles de toutes les classes…
          </p>
        ) : atRisk.length === 0 ? (
          <p style={{ fontSize: 13.5 }}>
            Aucun élève n'a une moyenne annuelle inférieure à 10 — tous les élèves seront promus
            selon le calcul automatique.
          </p>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>
              {atRisk.length} élève(s) ont une moyenne annuelle inférieure à 10 et redoubleront par
              défaut. Cochez pour accorder un passage exceptionnel à l'un d'entre eux.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {atRisk.map((row) => {
                const draft = exceptionalDrafts[row.studentId] ?? { checked: false, note: '' };
                return (
                  <div
                    key={row.studentId}
                    style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 10 }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={draft.checked}
                        onChange={(e) =>
                          setExceptionalDrafts((prev) => ({
                            ...prev,
                            [row.studentId]: { ...draft, checked: e.target.checked },
                          }))
                        }
                      />
                      <span style={{ fontWeight: 600 }}>{row.studentNom}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        — {row.className} — moyenne {row.moyenneAnnuelle.toFixed(2)}/20
                      </span>
                      <span>Passage exceptionnel</span>
                    </label>
                    {draft.checked ? (
                      <div style={{ marginTop: 8 }}>
                        <Field label="Note du directeur (optionnel)">
                          <Textarea
                            rows={2}
                            value={draft.note}
                            onChange={(e) =>
                              setExceptionalDrafts((prev) => ({
                                ...prev,
                                [row.studentId]: { ...draft, note: e.target.value },
                              }))
                            }
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 12 }}>{error}</p> : null}
      </Sheet>

      <Sheet
        title={assetDialog === 'stamp' ? 'Aucun tampon déposé' : 'Aucune signature déposée'}
        open={assetDialog !== null}
        onClose={() => setAssetDialog(null)}
      >
        <p>
          {assetDialog === 'stamp'
            ? "Aucun tampon n'est enregistré pour votre compte — vous ne pouvez pas cacheter de bulletin tant qu'il n'est pas déposé."
            : "Aucune signature n'est enregistrée pour votre compte — vous ne pouvez pas signer de bulletin tant qu'elle n'est pas déposée."}
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
    </div>
  );
}
