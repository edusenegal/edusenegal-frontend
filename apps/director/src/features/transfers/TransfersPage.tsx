import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Input, Segmented, Select, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type {
  InterSchoolStatus,
  InterSchoolTransfer,
  InternalTransferMapping,
  InternalTransferPreview,
  SchoolRef,
  StudentLookup,
  TransferRequest,
} from '@/types/domain';

const STATUS_TONE = { en_attente: 'warning', acceptee: 'success', refusee: 'danger' } as const;
const STATUS_LABEL = { en_attente: 'En attente', acceptee: 'Acceptée', refusee: 'Refusée' } as const;

const IS_TONE: Record<InterSchoolStatus, 'warning' | 'neutral' | 'success' | 'danger'> = {
  DEMANDE: 'warning',
  AUTORISE: 'neutral',
  ACCEPTE: 'success',
  REFUSE: 'danger',
  ANNULE: 'neutral',
  EXPIRE: 'neutral',
};
const IS_LABEL: Record<InterSchoolStatus, string> = {
  DEMANDE: 'Demande',
  AUTORISE: 'Autorisé',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  ANNULE: 'Annulé',
  EXPIRE: 'Expiré',
};

interface MappingDraft {
  remplacementId: string;
  note: string;
  semestre: string;
}

type InterneStep = 'form' | 'mapping' | 'fait';
type Vue = 'internes' | 'sortants' | 'entrants';
type Mode = 'interne' | 'inter';
type InterSub = 'vers-plateforme' | 'demander' | 'hors-plateforme';
type DetailSide = 'sortant' | 'entrant';

function frDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR');
}

export default function TransfersPage() {
  const { transfers, students, classes } = useServices();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [vue, setVue] = useState<Vue>('internes');
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('interne');
  const [interSub, setInterSub] = useState<InterSub>('vers-plateforme');

  const [sourceClassId, setSourceClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A → école de la plateforme
  const [destIndicatif, setDestIndicatif] = useState('');
  const [destSchool, setDestSchool] = useState<SchoolRef | null>(null);
  // B demande un entrant
  const [matricule, setMatricule] = useState('');
  const [lookup, setLookup] = useState<StudentLookup | null>(null);
  // A → hors plateforme
  const [offRegion, setOffRegion] = useState('');
  const [offSchoolName, setOffSchoolName] = useState('');

  // Assistant interne
  const [interneStep, setInterneStep] = useState<InterneStep>('form');
  const [preview, setPreview] = useState<InternalTransferPreview | null>(null);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});
  const [doneSummary, setDoneSummary] = useState<string | null>(null);

  // Fiche détail d'un transfert inter-écoles
  const [detail, setDetail] = useState<InterSchoolTransfer | null>(null);
  const [detailSide, setDetailSide] = useState<DetailSide>('sortant');
  const [acceptClassId, setAcceptClassId] = useState('');
  const [acceptResume, setAcceptResume] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dossierUrl, setDossierUrl] = useState<string | null>(null);

  const list = useQuery({ queryKey: ['transfers'], queryFn: () => transfers.list() });
  const studentList = useQuery({ queryKey: ['students'], queryFn: () => students.list() });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const outgoing = useQuery({ queryKey: ['transfers-out'], queryFn: () => transfers.listOutgoingTransfers() });
  const incoming = useQuery({ queryKey: ['transfers-in'], queryFn: () => transfers.listIncomingTransfers() });

  useEffect(() => {
    const preselected = (location.state as { studentId?: string } | null)?.studentId;
    if (preselected) {
      setStudentId(preselected);
      setSourceClassId(studentList.data?.find((s) => s.id === preselected)?.classeId ?? '');
      setModalOpen(true);
    }
  }, [location.key, studentList.data]);

  const fromClassId = sourceClassId;
  const studentsOfSourceClass = useMemo(
    () => studentList.data?.filter((s) => s.classeId === sourceClassId) ?? [],
    [studentList.data, sourceClassId],
  );

  function refreshInterSchool() {
    queryClient.invalidateQueries({ queryKey: ['transfers-out'] });
    queryClient.invalidateQueries({ queryKey: ['transfers-in'] });
  }

  // ── Assistant interne ──
  const previewMutation = useMutation({
    mutationFn: () => transfers.previewInternal(studentId, fromClassId, targetClassId),
    onSuccess: (result) => {
      setPreview(result);
      setMappingDrafts({});
      setInterneStep('mapping');
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof AppError ? err.message : "Impossible de préparer l'aperçu."),
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
      await classes.unenroll(fromClassId, studentId);
      await classes.enroll(targetClassId, studentId);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setDoneSummary(
        `Transfert effectué : ${result.matieresReportees} reportée(s), ${result.matieresExclues} en historique, ${result.matieresCreees} créée(s).`,
      );
      setInterneStep('fait');
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof AppError ? err.message : "Impossible d'exécuter le transfert."),
  });

  // ── Inter-écoles : création ──
  const resolveSchoolMutation = useMutation({
    mutationFn: () => transfers.resolveSchoolByIndicatif(destIndicatif.trim()),
    onSuccess: (res) => {
      setDestSchool(res);
      setError(null);
    },
    onError: (err: unknown) => {
      setDestSchool(null);
      setError(err instanceof AppError ? err.message : 'Aucune école pour cet indicatif.');
    },
  });

  const pushPlatformMutation = useMutation({
    mutationFn: () => transfers.createOutgoingTransfer({ studentId, toSchoolId: destSchool!.id }),
    onSuccess: () => { setVue('sortants'); closeAndRefresh(); },
    onError: (err: unknown) => setError(err instanceof AppError ? err.message : "Impossible d'émettre le transfert."),
  });

  const lookupMutation = useMutation({
    mutationFn: () => transfers.lookupStudent(matricule.trim()),
    onSuccess: (res) => { setLookup(res); setError(null); },
    onError: (err: unknown) => { setLookup(null); setError(err instanceof AppError ? err.message : 'Aucun élève pour ce matricule.'); },
  });

  const requestIncomingMutation = useMutation({
    mutationFn: () => transfers.createIncomingTransfer({ matricule: matricule.trim(), fromSchoolId: lookup!.currentSchoolId ?? '' }),
    onSuccess: () => { setVue('entrants'); closeAndRefresh(); },
    onError: (err: unknown) => setError(err instanceof AppError ? err.message : "Impossible d'envoyer la demande."),
  });

  const pushOffPlatformMutation = useMutation({
    mutationFn: () => transfers.createOutgoingTransfer({ studentId, offPlatform: true, offPlatformSchoolName: offSchoolName.trim(), offPlatformRegion: offRegion.trim() }),
    onSuccess: () => { setVue('sortants'); closeAndRefresh(); },
    onError: (err: unknown) => setError(err instanceof AppError ? err.message : "Impossible d'émettre le transfert."),
  });

  // ── Inter-écoles : actions (depuis la fiche détail) ──
  function onAction<T>(p: Promise<T>) {
    setDetailError(null);
    return p
      .then((r) => { refreshInterSchool(); return r; })
      .catch((err: unknown) => { setDetailError(err instanceof AppError ? err.message : 'Action impossible.'); throw err; });
  }
  const authorizeMutation = useMutation({ mutationFn: (id: string) => onAction(transfers.authorizeTransfer(id)), onSuccess: (r) => setDetail(r) });
  const refuseMutation = useMutation({ mutationFn: (id: string) => onAction(transfers.refuseTransfer(id)), onSuccess: (r) => setDetail(r) });
  const cancelMutation = useMutation({ mutationFn: (id: string) => onAction(transfers.cancelTransfer(id)), onSuccess: (r) => setDetail(r) });
  const acceptMutation = useMutation({
    mutationFn: () => onAction(transfers.acceptTransfer(detail!.id, { targetClassId: acceptClassId || undefined, resumeMode: acceptResume })),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['students'] }); setDetail(r); },
  });
  const dossierMutation = useMutation({
    // Le job est asynchrone : startDossier renvoie RUNNING sans URL, on
    // interroge getDossierJob jusqu'au statut terminal avant de télécharger.
    mutationFn: async (id: string) => {
      setDetailError(null);
      setDossierUrl(null);
      const started = await transfers.startDossier(id);
      let job = started;
      for (let i = 0; i < 40 && job.status === 'RUNNING'; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        job = await transfers.getDossierJob(started.jobId);
      }
      return job;
    },
    onSuccess: (job) => {
      refreshInterSchool();
      if (job.status === 'FAILED') {
        setDetailError(job.error ? `Dossier : ${job.error}` : 'Échec de la génération du dossier.');
        return;
      }
      if (job.status === 'RUNNING') {
        setDetailError('Le dossier est encore en préparation — réessayez dans un instant.');
        return;
      }
      setDossierUrl(job.downloadUrl ?? null);
      if (job.downloadUrl && job.downloadUrl !== '#') window.open(job.downloadUrl, '_blank', 'noopener');
    },
    onError: (err: unknown) => setDetailError(err instanceof AppError ? err.message : 'Dossier indisponible.'),
  });

  function closeModal() {
    setModalOpen(false);
    setMode('interne');
    setInterSub('vers-plateforme');
    setSourceClassId(''); setStudentId(''); setTargetClassId('');
    setDestIndicatif(''); setDestSchool(null);
    setMatricule(''); setLookup(null);
    setOffRegion(''); setOffSchoolName('');
    setError(null); setInterneStep('form'); setPreview(null); setMappingDrafts({}); setDoneSummary(null);
  }
  function closeAndRefresh() {
    refreshInterSchool();
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
    closeModal();
  }
  function openDetail(t: InterSchoolTransfer, side: DetailSide) {
    setDetail(t); setDetailSide(side); setDetailError(null); setAcceptClassId(''); setAcceptResume(false); setDossierUrl(null);
  }

  function onSubmit() {
    setError(null);
    if (mode === 'inter') {
      if (interSub === 'vers-plateforme') {
        if (!sourceClassId || !studentId) return setError('Choisissez la classe puis l’élève.');
        if (!destSchool) return setError('Recherchez l’école de destination par son indicatif.');
        return pushPlatformMutation.mutate();
      }
      if (interSub === 'demander') {
        if (!lookup) return setError('Recherchez d’abord l’élève par son matricule.');
        return requestIncomingMutation.mutate();
      }
      if (!sourceClassId || !studentId) return setError('Choisissez la classe puis l’élève.');
      if (!offSchoolName.trim()) return setError('Indiquez l’école de destination.');
      return pushOffPlatformMutation.mutate();
    }
    if (!sourceClassId) return setError('Choisissez la classe de l’élève.');
    if (!studentId) return setError('Choisissez un élève.');
    if (!targetClassId) return setError('Choisissez la classe de destination.');
    previewMutation.mutate();
  }

  function setDraft(orphanSubjectId: string, patch: Partial<MappingDraft>) {
    setMappingDrafts((prev) => ({ ...prev, [orphanSubjectId]: { remplacementId: '', note: '', semestre: '1', ...prev[orphanSubjectId], ...patch } }));
  }
  function onConfirmTransfer() {
    for (const draft of Object.values(mappingDrafts)) {
      if (draft.remplacementId && draft.note.trim() && !draft.semestre) return setError('Choisissez un semestre pour chaque note saisie.');
    }
    setError(null);
    executeMutation.mutate();
  }

  // ── Colonnes ──
  const interneColumns: Column<TransferRequest>[] = [
    { key: 'eleve', header: 'Élève', render: (r) => r.studentNom },
    { key: 'destination', header: 'Destination', render: (r) => classList.data?.find((c) => c.id === r.classeArriveeId)?.name ?? '—' },
    { key: 'date', header: 'Date', render: (r) => r.date },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut]}</Badge> },
  ];
  const outColumns: Column<InterSchoolTransfer>[] = [
    { key: 'eleve', header: 'Élève', render: (r) => r.studentName ?? r.studentMatricule ?? '—' },
    { key: 'dest', header: 'Destination', render: (r) => (r.offPlatform ? `${r.offPlatformSchoolName ?? '—'} (hors plateforme)` : r.toSchoolName ?? '—') },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={IS_TONE[r.status]}>{IS_LABEL[r.status]}</Badge> },
    { key: 'date', header: 'Date', render: (r) => frDate(r.createdAt) },
  ];
  const inColumns: Column<InterSchoolTransfer>[] = [
    { key: 'eleve', header: 'Élève', render: (r) => r.studentName ?? r.studentMatricule ?? '—' },
    { key: 'orig', header: 'Origine', render: (r) => r.fromSchoolName ?? '—' },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={IS_TONE[r.status]}>{IS_LABEL[r.status]}</Badge> },
    { key: 'date', header: 'Date', render: (r) => frDate(r.createdAt) },
  ];

  const footer =
    mode === 'inter' ? (
      <>
        <Button variant="secondary" onClick={closeModal}>Annuler</Button>
        <Button
          variant="primary"
          loading={pushPlatformMutation.isPending || requestIncomingMutation.isPending || pushOffPlatformMutation.isPending}
          onClick={onSubmit}
        >
          {interSub === 'demander' ? 'Envoyer la demande' : 'Émettre le transfert'}
        </Button>
      </>
    ) : interneStep === 'form' ? (
      <>
        <Button variant="secondary" onClick={closeModal}>Annuler</Button>
        <Button variant="primary" loading={previewMutation.isPending} onClick={onSubmit}>Aperçu →</Button>
      </>
    ) : interneStep === 'mapping' ? (
      <>
        <Button variant="secondary" onClick={() => setInterneStep('form')}>← Retour</Button>
        <Button variant="primary" loading={executeMutation.isPending} onClick={onConfirmTransfer}>Confirmer</Button>
      </>
    ) : (
      <Button variant="primary" onClick={closeAndRefresh}>Fermer</Button>
    );

  const activeList = vue === 'internes' ? (
    <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0} emptyLabel="Aucun transfert interne.">
      <Table columns={interneColumns} rows={list.data ?? []} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/transferts/${r.id}`)} />
    </StateView>
  ) : vue === 'sortants' ? (
    <StateView loading={outgoing.isLoading} error={outgoing.error} empty={(outgoing.data?.length ?? 0) === 0} emptyLabel="Aucun transfert sortant.">
      <Table columns={outColumns} rows={outgoing.data ?? []} rowKey={(r) => r.id} onRowClick={(r) => openDetail(r, 'sortant')} />
    </StateView>
  ) : (
    <StateView loading={incoming.isLoading} error={incoming.error} empty={(incoming.data?.length ?? 0) === 0} emptyLabel="Aucun transfert entrant.">
      <Table columns={inColumns} rows={incoming.data ?? []} rowKey={(r) => r.id} onRowClick={(r) => openDetail(r, 'entrant')} />
    </StateView>
  );

  return (
    <div>
      <PageHeader
        title="Transferts"
        subtitle="Changement de classe, ou transfert d’un élève vers / depuis une autre école."
        action={<Button variant="primary" onClick={() => setModalOpen(true)}>+ Nouvelle demande</Button>}
      />

      <Card padded>
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <Segmented<Vue>
            options={[
              { value: 'internes', label: 'Internes' },
              { value: 'sortants', label: 'Sortants' },
              { value: 'entrants', label: 'Entrants' },
            ]}
            value={vue}
            onChange={setVue}
          />
        </div>
        {activeList}
      </Card>

      {/* Fiche détail d'un transfert inter-écoles */}
      <Sheet
        title="Dossier de transfert"
        open={detail !== null}
        onClose={() => setDetail(null)}
        width="lg"
        footer={<Button variant="secondary" onClick={() => setDetail(null)}>Fermer</Button>}
      >
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{detail.studentName ?? detail.studentMatricule ?? 'Élève'}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {detailSide === 'sortant'
                  ? `Vers ${detail.offPlatform ? `${detail.offPlatformSchoolName ?? '—'} (hors plateforme)` : detail.toSchoolName ?? '—'}`
                  : `Depuis ${detail.fromSchoolName ?? '—'}`}
              </div>
              <div style={{ marginTop: 6 }}><Badge tone={IS_TONE[detail.status]}>{IS_LABEL[detail.status]}</Badge></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 13 }}>
              {detail.studentMatricule ? <Info k="Matricule" v={detail.studentMatricule} /> : null}
              <Info k="Créé le" v={frDate(detail.createdAt)} />
              {detail.reason ? <Info k="Motif" v={detail.reason} /> : null}
            </div>

            {/* Dossier scolaire complet (liens des fichiers académiques) */}
            <Card padded>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Dossier scolaire</div>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
                Dossier complet de l’élève (identité, parcours ; bulletins signés, relevés et reçus de paiement référencés).
                Disponible une fois le transfert autorisé.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={dossierMutation.isPending}
                  onClick={() => dossierMutation.mutate(detail.id)}
                >
                  Générer / télécharger le dossier (ZIP)
                </Button>
                {dossierUrl && dossierUrl !== '#' ? (
                  <a href={dossierUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>Ouvrir le dossier</a>
                ) : null}
              </div>
            </Card>

            {/* Actions contextuelles */}
            {detailError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{detailError}</p> : null}
            {detailSide === 'sortant' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detail.status === 'DEMANDE' ? (
                  <>
                    <Button variant="primary" loading={authorizeMutation.isPending} onClick={() => authorizeMutation.mutate(detail.id)}>Autoriser la libération</Button>
                    <Button variant="secondary" onClick={() => refuseMutation.mutate(detail.id)}>Refuser</Button>
                  </>
                ) : null}
                {detail.status === 'AUTORISE' ? (
                  <Button variant="secondary" onClick={() => cancelMutation.mutate(detail.id)}>Annuler le transfert</Button>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {detail.status === 'DEMANDE' ? (
                  <div><Button variant="secondary" onClick={() => cancelMutation.mutate(detail.id)}>Annuler ma demande</Button></div>
                ) : null}
                {detail.status === 'AUTORISE' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Field label="Classe d’affectation">
                      <Select value={acceptClassId} onChange={(e) => setAcceptClassId(e.target.value)}>
                        <option value="">— À affecter plus tard —</option>
                        {classList.data?.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </Select>
                    </Field>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <input type="checkbox" checked={acceptResume} onChange={(e) => setAcceptResume(e.target.checked)} />
                      Mode reprise — continuité des notes de l’école précédente
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button variant="primary" loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>Accepter et inscrire</Button>
                      <Button variant="secondary" onClick={() => refuseMutation.mutate(detail.id)}>Refuser</Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </Sheet>

      {/* Modale de création */}
      <Sheet
        title={mode === 'interne' && interneStep !== 'form' ? 'Transfert interne' : 'Nouvelle demande de transfert'}
        open={modalOpen}
        onClose={closeModal}
        width="lg"
        footer={footer}
      >
        {!(mode === 'interne' && interneStep !== 'form') ? (
          <div style={{ marginBottom: 16 }}>
            <Segmented<Mode>
              options={[
                { value: 'interne', label: 'Même établissement' },
                { value: 'inter', label: 'Autre école' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        ) : null}

        {mode === 'inter' ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Segmented<InterSub>
                options={[
                  { value: 'vers-plateforme', label: 'Vers une école' },
                  { value: 'demander', label: 'Demander un élève' },
                  { value: 'hors-plateforme', label: 'Hors plateforme' },
                ]}
                value={interSub}
                onChange={(v) => { setInterSub(v); setError(null); }}
              />
            </div>

            {interSub === 'vers-plateforme' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                  Transférez un de vos élèves vers une autre école de la plateforme. L’école d’arrivée devra accepter.
                </p>
                <Field label="Classe de l’élève" required>
                  <Select value={sourceClassId} onChange={(e) => { setSourceClassId(e.target.value); setStudentId(''); }}>
                    <option value="">— Choisir une classe —</option>
                    {classList.data?.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </Select>
                </Field>
                <Field label="Élève" required>
                  <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!sourceClassId}>
                    <option value="">{sourceClassId ? '— Choisir un élève —' : '— Choisissez d’abord la classe —'}</option>
                    {studentsOfSourceClass.map((s) => (<option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>))}
                  </Select>
                </Field>
                <Field label="Indicatif de l’école de destination">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <Input
                      value={destIndicatif}
                      onChange={(e) => { setDestIndicatif(e.target.value); setDestSchool(null); }}
                      placeholder="Ex. CEMT-LG"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <Button variant="secondary" loading={resolveSchoolMutation.isPending} disabled={!destIndicatif.trim()} onClick={() => resolveSchoolMutation.mutate()}>
                      Rechercher
                    </Button>
                  </div>
                </Field>
                {destSchool ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--color-success)', borderRadius: 10, fontSize: 13 }}>
                    <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✓</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{destSchool.name ?? destSchool.indicatif ?? '—'}</div>
                      <div style={{ color: 'var(--color-text-muted)' }}>École trouvée · indicatif {destSchool.indicatif ?? '—'}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : interSub === 'demander' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                  Saisissez le matricule (numéro de carte étudiant) de l’élève. Son école actuelle devra autoriser la libération du dossier.
                </p>
                <Field label="Matricule de l’élève">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <Input
                      value={matricule}
                      onChange={(e) => { setMatricule(e.target.value); setLookup(null); }}
                      placeholder="EDUSEN-…"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <Button variant="secondary" loading={lookupMutation.isPending} disabled={!matricule.trim()} onClick={() => lookupMutation.mutate()}>Rechercher</Button>
                  </div>
                </Field>
                {lookup ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--color-success)', borderRadius: 10, fontSize: 13 }}>
                    <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✓</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{lookup.name ?? '—'}</div>
                      <div style={{ color: 'var(--color-text-muted)' }}>École actuelle : {lookup.currentSchoolName ?? lookup.currentSchoolId ?? '—'}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                  Transfert vers une école non gérée par la plateforme : un dossier (ZIP) et un certificat de sortie sont produits, l’inscription est clôturée.
                </p>
                <Field label="Classe de l’élève" required>
                  <Select value={sourceClassId} onChange={(e) => { setSourceClassId(e.target.value); setStudentId(''); }}>
                    <option value="">— Choisir une classe —</option>
                    {classList.data?.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </Select>
                </Field>
                <Field label="Élève" required>
                  <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!sourceClassId}>
                    <option value="">{sourceClassId ? '— Choisir un élève —' : '— Choisissez d’abord la classe —'}</option>
                    {studentsOfSourceClass.map((s) => (<option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>))}
                  </Select>
                </Field>
                <Field label="Région de destination"><Input value={offRegion} onChange={(e) => setOffRegion(e.target.value)} placeholder="Ex. Dakar" /></Field>
                <Field label="École de destination" required><Input value={offSchoolName} onChange={(e) => setOffSchoolName(e.target.value)} placeholder="Nom de l’école" /></Field>
              </div>
            )}
          </div>
        ) : interneStep === 'mapping' && preview ? (
          <div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              {preview.matieresCommunes.length} matière(s) commune(s) reportée(s) automatiquement avec le coefficient de la classe d’arrivée.
            </p>
            {preview.matieresOrphelines.length === 0 ? (
              <p style={{ fontSize: 13 }}>Aucune matière orpheline — le transfert peut être confirmé directement.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {preview.matieresOrphelines.map((orphan) => {
                  const draft = mappingDrafts[orphan.subjectId] ?? { remplacementId: '', note: '', semestre: '1' };
                  return (
                    <div key={orphan.subjectId} style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 10 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {orphan.subjectNom} <span style={{ color: 'var(--color-text-muted)' }}>(coef. {orphan.coefficientDepart})</span>
                      </div>
                      {orphan.aDesNotes ? (
                        <p style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 8 }}>Notes existantes — conservées en historique sur l’ancienne classe.</p>
                      ) : null}
                      <Field label="Matière de remplacement (optionnel)">
                        <Select value={draft.remplacementId} onChange={(e) => setDraft(orphan.subjectId, { remplacementId: e.target.value })}>
                          <option value="">— Laisser en historique —</option>
                          {preview.matieresCandidates.map((c) => (<option key={c.subjectId} value={c.subjectId}>{c.subjectNom} (coef. {c.coefficientArrivee})</option>))}
                        </Select>
                      </Field>
                      {draft.remplacementId ? (
                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                          <Field label="Note (optionnel)"><Input type="number" min={0} max={20} step={0.25} value={draft.note} onChange={(e) => setDraft(orphan.subjectId, { note: e.target.value })} /></Field>
                          <Field label="Semestre" required={!!draft.note.trim()}>
                            <Select value={draft.semestre} onChange={(e) => setDraft(orphan.subjectId, { semestre: e.target.value })}>
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
            )}
          </div>
        ) : interneStep === 'fait' ? (
          <p style={{ fontSize: 14, color: 'var(--color-success)' }}>{doneSummary}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Classe de l’élève" required>
              <Select value={sourceClassId} onChange={(e) => { setSourceClassId(e.target.value); setStudentId(''); }}>
                <option value="">— Choisir une classe —</option>
                {classList.data?.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </Select>
            </Field>
            <Field label="Élève" required>
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!sourceClassId}>
                <option value="">{sourceClassId ? '— Choisir un élève —' : '— Choisissez d’abord la classe —'}</option>
                {studentsOfSourceClass.map((s) => (<option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>))}
              </Select>
            </Field>
            <Field label="Classe de destination" required>
              <Select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
                <option value="">— Choisir une classe —</option>
                {classList.data?.filter((c) => c.id !== fromClassId).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </Select>
            </Field>
          </div>
        )}

        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 12 }}>{error}</p> : null}
      </Sheet>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{k}</div>
      <div>{v}</div>
    </div>
  );
}
