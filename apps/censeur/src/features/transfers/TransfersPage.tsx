import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Input, Select, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { InternalTransferMapping, InternalTransferPreview, TransferRequest } from '@/types/domain';

const STATUS_TONE = { en_attente: 'warning', acceptee: 'success', refusee: 'danger' } as const;
const STATUS_LABEL = { en_attente: 'En attente', acceptee: 'Acceptée', refusee: 'Refusée' } as const;

const REGIONS = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor'];
const SCHOOLS_BY_REGION: Record<string, string[]> = {
  Dakar: ['Lycée John F. Kennedy', 'Lycée Blaise Diagne', 'Lycée Seydina Limamoulaye'],
  Thiès: ['Lycée Malick Sy', 'Lycée El Hadji Omar Lamine Badiane'],
  'Saint-Louis': ['Lycée Charles de Gaulle', 'Lycée El Hadji Amadou Malick Gaye'],
  Ziguinchor: ['Lycée Djignabo'],
};

/** Un brouillon de mapping par matière orpheline — saisi à l'étape 2 de l'assistant interne. */
interface MappingDraft {
  remplacementId: string; // '' = pas de remplacement choisi, la matière reste en historique
  note: string; // chaîne du champ, vide = aucune note saisie
  semestre: string; // chaîne du champ select
}

type InterneStep = 'form' | 'mapping' | 'fait';

export default function TransfersPage() {
  const { transfers, students, classes } = useServices();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'interne' | 'externe'>('interne');
  const [sourceClassId, setSourceClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [region, setRegion] = useState(REGIONS[0]!);
  const [schoolName, setSchoolName] = useState(SCHOOLS_BY_REGION[REGIONS[0]!]![0]!);
  const [error, setError] = useState<string | null>(null);

  // Assistant de transfert interne (task #214/#215) : étape 1 (ce formulaire)
  // → aperçu des matières (étape 2, avec mapping des orphelines) → exécution.
  const [interneStep, setInterneStep] = useState<InterneStep>('form');
  const [preview, setPreview] = useState<InternalTransferPreview | null>(null);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});
  const [doneSummary, setDoneSummary] = useState<string | null>(null);

  const list = useQuery({ queryKey: ['transfers'], queryFn: () => transfers.list() });
  const studentList = useQuery({ queryKey: ['students'], queryFn: () => students.list() });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });

  // Arrivée depuis la fiche d'un élève (bouton « Transférer ») : préremplit
  // et ouvre directement le formulaire avec cet élève et sa classe actuelle.
  useEffect(() => {
    const preselected = (location.state as { studentId?: string } | null)?.studentId;
    if (preselected) {
      setStudentId(preselected);
      setSourceClassId(studentList.data?.find((s) => s.id === preselected)?.classeId ?? '');
      setModalOpen(true);
    }
  }, [location.key, studentList.data]);

  const schoolsOfRegion = useMemo(() => [...(SCHOOLS_BY_REGION[region] ?? [])].sort((a, b) => a.localeCompare(b)), [region]);

  // task #232 : la classe de départ est choisie en premier (plutôt que déduite de
  // l'élève) — l'élève n'est ensuite qu'un choix parmi ceux de cette classe.
  const fromClassId = sourceClassId;
  const studentsOfSourceClass = useMemo(
    () => studentList.data?.filter((s) => s.classeId === sourceClassId) ?? [],
    [studentList.data, sourceClassId],
  );

  const previewMutation = useMutation({
    mutationFn: () => transfers.previewInternal(studentId, fromClassId, targetClassId),
    onSuccess: (result) => {
      setPreview(result);
      setMappingDrafts({});
      setInterneStep('mapping');
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof AppError ? err.message : "Impossible de préparer l'aperçu du transfert."),
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const mappings: InternalTransferMapping[] = Object.entries(mappingDrafts)
        .filter(([, draft]) => draft.remplacementId)
        .map(([orphanSubjectId, draft]) => ({
          matiereOrphelineId: orphanSubjectId,
          matiereRemplacementId: draft.remplacementId,
          note: draft.note.trim() ? Number(draft.note) : null,
          semestre: draft.note.trim() ? Number(draft.semestre) : null,
        }));
      const result = await transfers.executeInternal(studentId, fromClassId, targetClassId, mappings);
      // Le report des notes ci-dessus ne change pas l'inscription — aucune
      // propagation de jeton entre services côté backend (voir le
      // commentaire de TransfersPort) : c'est ce frontend qui enchaîne,
      // avec le jeton réel du directeur, pour achever le transfert.
      await classes.unenroll(fromClassId, studentId);
      await classes.enroll(targetClassId, studentId);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setDoneSummary(
        `Transfert effectué : ${result.matieresReportees} matière(s) reportée(s), ${result.matieresExclues} exclue(s) ` +
          `(restées en historique sur l'ancienne classe), ${result.matieresCreees} créée(s) par remplacement.`,
      );
      setInterneStep('fait');
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof AppError ? err.message : "Impossible d'exécuter le transfert."),
  });

  const externalMutation = useMutation({
    mutationFn: () => transfers.requestExternal(studentId, region, schoolName),
    onSuccess: closeAndRefresh,
  });

  function closeModal() {
    setModalOpen(false);
    setMode('interne');
    setSourceClassId('');
    setStudentId('');
    setTargetClassId('');
    setError(null);
    setInterneStep('form');
    setPreview(null);
    setMappingDrafts({});
    setDoneSummary(null);
  }

  function closeAndRefresh() {
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    closeModal();
  }

  function onSubmit() {
    if (!sourceClassId) {
      setError('Choisissez la classe de l’élève.');
      return;
    }
    if (!studentId) {
      setError('Choisissez un élève.');
      return;
    }
    if (mode === 'externe') {
      externalMutation.mutate();
      return;
    }
    // mode === 'interne', étape 'form' : prépare l'aperçu avant toute exécution.
    if (!targetClassId) {
      setError('Choisissez la classe de destination.');
      return;
    }
    previewMutation.mutate();
  }

  function setDraft(orphanSubjectId: string, patch: Partial<MappingDraft>) {
    setMappingDrafts((prev) => ({
      ...prev,
      [orphanSubjectId]: { remplacementId: '', note: '', semestre: '1', ...prev[orphanSubjectId], ...patch },
    }));
  }

  function onConfirmTransfer() {
    // Une note saisie sans semestre (ou l'inverse) n'a pas de sens — F-PED-5
    // exige le semestre pour toute moyenne créée.
    for (const draft of Object.values(mappingDrafts)) {
      if (draft.remplacementId && draft.note.trim() && !draft.semestre) {
        setError('Choisissez un semestre pour chaque note saisie.');
        return;
      }
    }
    setError(null);
    executeMutation.mutate();
  }

  const columns: Column<TransferRequest>[] = [
    { key: 'eleve', header: 'Élève', render: (r) => r.studentNom },
    { key: 'mode', header: 'Type', render: (r) => (r.mode === 'interne' ? 'Interne' : 'Externe') },
    {
      key: 'destination',
      header: 'Destination',
      render: (r) =>
        r.mode === 'interne'
          ? classList.data?.find((c) => c.id === r.classeArriveeId)?.name ?? '—'
          : `${r.ecoleDestination} (${r.regionDestination})`,
    },
    { key: 'date', header: 'Date', render: (r) => r.date },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut]}</Badge> },
  ];

  const footer =
    mode === 'externe' ? (
      <>
        <Button variant="secondary" onClick={closeModal}>
          Annuler
        </Button>
        <Button id="t-send-ext" variant="primary" loading={externalMutation.isPending} onClick={onSubmit}>
          Envoyer la demande
        </Button>
      </>
    ) : interneStep === 'form' ? (
      <>
        <Button variant="secondary" onClick={closeModal}>
          Annuler
        </Button>
        <Button id="t-preview-int" variant="primary" loading={previewMutation.isPending} onClick={onSubmit}>
          Aperçu →
        </Button>
      </>
    ) : interneStep === 'mapping' ? (
      <>
        <Button variant="secondary" onClick={() => setInterneStep('form')}>
          ← Retour
        </Button>
        <Button id="t-confirm-int" variant="primary" loading={executeMutation.isPending} onClick={onConfirmTransfer}>
          Confirmer le transfert
        </Button>
      </>
    ) : (
      <Button variant="primary" onClick={closeAndRefresh}>
        Fermer
      </Button>
    );

  return (
    <div>
      <PageHeader
        title="Transferts"
        subtitle="Transférer un élève vers une autre classe de l’établissement, ou vers une autre école."
        action={
          <Button id="btn-new-transfer" variant="primary" onClick={() => setModalOpen(true)}>
            + Nouvelle demande
          </Button>
        }
      />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/transferts/${r.id}`)} />
        </StateView>
      </Card>

      <Sheet
        title={mode === 'interne' && interneStep !== 'form' ? 'Transfert interne' : 'Nouvelle demande de transfert'}
        open={modalOpen}
        onClose={closeModal}
        width="lg"
        footer={footer}
      >
        {mode === 'interne' && interneStep !== 'form' ? null : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button
              type="button"
              variant={mode === 'interne' ? 'primary' : 'secondary'}
              size="sm"
              data-tmode="interne"
              onClick={() => setMode('interne')}
            >
              Vers une classe de l’établissement
            </Button>
            <Button
              type="button"
              variant={mode === 'externe' ? 'primary' : 'secondary'}
              size="sm"
              data-tmode="externe"
              onClick={() => setMode('externe')}
            >
              Vers une autre école
            </Button>
          </div>
        )}

        {mode === 'interne' && interneStep === 'mapping' && preview ? (
          <div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              {preview.matieresCommunes.length} matière(s) commune(s) aux deux classes seront reportées automatiquement,
              avec le coefficient de la classe d’arrivée.
            </p>

            {preview.matieresOrphelines.length === 0 ? (
              <p style={{ fontSize: 13 }}>Aucune matière orpheline — le transfert peut être confirmé directement.</p>
            ) : (
              <>
                <p style={{ fontSize: 13, marginBottom: 8 }}>
                  {preview.matieresOrphelines.length} matière(s) de la classe de départ n’existe(nt) pas dans la classe
                  d’arrivée. Pour chacune, vous pouvez choisir une matière de remplacement (avec une note), ou la laisser en
                  historique sur l’ancienne classe.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {preview.matieresOrphelines.map((orphan) => {
                    const draft = mappingDrafts[orphan.subjectId] ?? { remplacementId: '', note: '', semestre: '1' };
                    return (
                      <div
                        key={orphan.subjectId}
                        style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 10 }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          {orphan.subjectNom} <span style={{ color: 'var(--color-text-muted)' }}>(coef. {orphan.coefficientDepart})</span>
                        </div>
                        {orphan.aDesNotes ? (
                          <p style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 8 }}>
                            Cette matière a déjà des notes — elles resteront en historique sur l’ancienne classe.
                          </p>
                        ) : null}
                        <Field label="Matière de remplacement (optionnel)">
                          <Select
                            value={draft.remplacementId}
                            onChange={(e) => setDraft(orphan.subjectId, { remplacementId: e.target.value })}
                          >
                            <option value="">— Laisser en historique —</option>
                            {preview.matieresCandidates.map((c) => (
                              <option key={c.subjectId} value={c.subjectId}>
                                {c.subjectNom} (coef. {c.coefficientArrivee})
                              </option>
                            ))}
                          </Select>
                        </Field>
                        {draft.remplacementId ? (
                          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <Field label="Note (optionnel)">
                              <Input
                                type="number"
                                min={0}
                                max={20}
                                step={0.25}
                                value={draft.note}
                                onChange={(e) => setDraft(orphan.subjectId, { note: e.target.value })}
                              />
                            </Field>
                            <Field label="Semestre" required={!!draft.note.trim()}>
                              <Select
                                value={draft.semestre}
                                onChange={(e) => setDraft(orphan.subjectId, { semestre: e.target.value })}
                              >
                                <option value="1">Semestre 1</option>
                                <option value="2">Semestre 2</option>
                              </Select>
                            </Field>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : mode === 'interne' && interneStep === 'fait' ? (
          <p style={{ fontSize: 14, color: 'var(--color-success)' }}>{doneSummary}</p>
        ) : (
          <>
            <Field label="Classe de l’élève" required>
              <Select
                value={sourceClassId}
                onChange={(e) => {
                  setSourceClassId(e.target.value);
                  setStudentId('');
                }}
              >
                <option value="">— Choisir une classe —</option>
                {classList.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Élève" required>
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!sourceClassId}>
                <option value="">
                  {sourceClassId ? '— Choisir un élève —' : '— Choisissez d’abord la classe —'}
                </option>
                {studentsOfSourceClass.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.prenom} {s.nom}
                  </option>
                ))}
              </Select>
            </Field>

            {mode === 'interne' ? (
              <Field label="Classe de destination" required>
                <Select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
                  <option value="">— Choisir une classe —</option>
                  {classList.data
                    ?.filter((c) => c.id !== fromClassId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Région">
                  <Select
                    id="t-region"
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value);
                      setSchoolName(SCHOOLS_BY_REGION[e.target.value]?.[0] ?? '');
                    }}
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="École de destination">
                  <Select id="t-school" value={schoolName} onChange={(e) => setSchoolName(e.target.value)}>
                    {schoolsOfRegion.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div
                  id="t-school-details"
                  style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13, color: 'var(--color-text-muted)' }}
                >
                  Cette demande sera enregistrée comme une demande de transfert externe. Ce prototype ne communique pas avec le
                  système de l’école de destination — la suite du transfert se fait hors application.
                </div>
              </>
            )}
          </>
        )}

        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 12 }}>{error}</p> : null}
      </Sheet>
    </div>
  );
}
