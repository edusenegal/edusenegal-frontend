import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Input, Segmented, Select, StateView } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { Mention, PromotionResult, SemesterResult, YearResult } from '@/types/domain';

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
  const { classes, subjects, academicResults } = useServices();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

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
  const closeYearMutation = useMutation({
    mutationFn: () => academicResults.closeResultsYear(),
  });

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
              Verrouille les notes d'une matière pour ce semestre — préalable au calcul des moyennes. Action écrite
              seule côté backend réel : rien n'indique ici quelles matières ont déjà été verrouillées lors d'une
              session précédente.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
              <Field label="Matière">
                <Select value={subjectToLock} onChange={(e) => setSubjectToLock(e.target.value)} style={{ minWidth: 220 }}>
                  {classSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom}</option>
                  ))}
                </Select>
              </Field>
              <Button
                variant="secondary"
                disabled={!subjectToLock}
                loading={lockMutation.isPending}
                onClick={() =>
                  runMutation(() => lockMutation.mutateAsync(subjectToLock), () =>
                    setLockedThisSession((prev) => new Set(prev).add(`${subjectToLock}|${semesterNumber}`)),
                  )
                }
              >
                Verrouiller
              </Button>
              {lockedThisSession.has(`${subjectToLock}|${semesterNumber}`) ? (
                <Badge tone="success">Verrouillée dans cette session</Badge>
              ) : null}
            </div>
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
                        <th style={{ padding: '6px 8px' }}>Moyenne</th>
                        <th style={{ padding: '6px 8px' }}>Mention</th>
                        <th style={{ padding: '6px 8px' }}>Bulletin</th>
                        <th style={{ padding: '6px 8px' }}>Publié</th>
                        <th style={{ padding: '6px 8px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row: SemesterResult) => (
                        <tr key={row.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px 8px 8px 0', fontWeight: 600 }}>{row.rangClasse}</td>
                          <td style={{ padding: 8 }}>{row.studentNom}</td>
                          <td style={{ padding: 8, fontWeight: 600 }}>{row.moyenneGenerale.toFixed(2)}/20</td>
                          <td style={{ padding: 8 }}>
                            <Badge tone={MENTION_TONES[row.mention]}>{MENTION_LABELS[row.mention]}</Badge>
                          </td>
                          <td style={{ padding: 8 }}>{row.bulletinGenere ? '✅' : '—'}</td>
                          <td style={{ padding: 8 }}>{row.publie ? '✅' : '—'}</td>
                          <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                            {row.bulletinGenere ? (
                              <Button
                                variant="secondary"
                                loading={downloadMutation.isPending && downloadMutation.variables === row.studentId}
                                onClick={() => runMutation(() => downloadMutation.mutateAsync(row.studentId))}
                              >
                                Télécharger
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                loading={generateOneBulletinMutation.isPending && generateOneBulletinMutation.variables === row.studentId}
                                onClick={() => runMutation(() => generateOneBulletinMutation.mutateAsync(row.studentId))}
                              >
                                Générer
                              </Button>
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
              <Button
                variant="primary"
                loading={closeYearMutation.isPending}
                onClick={() => runMutation(() => closeYearMutation.mutateAsync())}
              >
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
    </div>
  );
}
