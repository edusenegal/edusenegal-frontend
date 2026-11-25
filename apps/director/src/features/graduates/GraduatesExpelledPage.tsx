import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Input, Select, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { Mention, Student, YearResult } from '@/types/domain';

const MENTION_LABEL: Record<Mention, string> = {
  excellent: 'Excellent',
  tres_bien: 'Très bien',
  bien: 'Bien',
  assez_bien: 'Assez bien',
  passable: 'Passable',
  insuffisant: 'Insuffisant',
};

export default function GraduatesExpelledPage() {
  const { academicResults, students, transfers } = useServices();
  const graduates = useQuery({ queryKey: ['graduates'], queryFn: () => academicResults.getGraduates() });
  const expelled = useQuery({ queryKey: ['expelled'], queryFn: () => students.getExpelled() });

  // Sélection pour le transfert (individuel = 1 coché, bulk = plusieurs).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [transferOpen, setTransferOpen] = useState(false);
  const [mode, setMode] = useState<'platform' | 'offplatform'>('platform');
  const [indicatif, setIndicatif] = useState('');
  const [destSchool, setDestSchool] = useState<{ id: string; name: string | null } | null>(null);
  const [offName, setOffName] = useState('');
  const [offRegion, setOffRegion] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const rows = graduates.data ?? [];
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.studentId));
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.studentId)));
  }

  const resolveMutation = useMutation({
    mutationFn: () => transfers.resolveSchoolByIndicatif(indicatif.trim()),
    onSuccess: (s) => { setDestSchool({ id: s.id, name: s.name }); setErr(null); },
    onError: (e: unknown) => { setDestSchool(null); setErr(e instanceof AppError ? e.message : 'Aucune école pour cet indicatif.'); },
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      for (const studentId of ids) {
        await transfers.createOutgoingTransfer(
          mode === 'platform'
            ? { studentId, toSchoolId: destSchool!.id, reason: reason.trim() || undefined }
            : { studentId, offPlatform: true, offPlatformSchoolName: offName.trim(), offPlatformRegion: offRegion.trim(), reason: reason.trim() || undefined },
        );
      }
      return ids.length;
    },
    onSuccess: (n) => { setDone(n); setTransferOpen(false); setSelected(new Set()); },
    onError: (e: unknown) => setErr(e instanceof AppError ? e.message : 'Transfert impossible.'),
  });

  function openTransfer() {
    setErr(null);
    setDone(null);
    setMode('platform');
    setIndicatif('');
    setDestSchool(null);
    setOffName('');
    setOffRegion('');
    setReason('');
    setTransferOpen(true);
  }

  function submitTransfer() {
    setErr(null);
    if (selected.size === 0) return setErr('Sélectionnez au moins un diplômé.');
    if (mode === 'platform' && !destSchool) return setErr("Recherchez l'école de destination par son indicatif.");
    if (mode === 'offplatform' && !offName.trim()) return setErr("Saisissez le nom de l'école (hors plateforme).");
    transferMutation.mutate();
  }

  const gradCols: Column<YearResult>[] = [
    {
      key: 'sel',
      header: (<input type="checkbox" aria-label="Tout sélectionner" checked={allChecked} onChange={toggleAll} />) as unknown as string,
      render: (r) => <input type="checkbox" checked={selected.has(r.studentId)} onChange={() => toggle(r.studentId)} />,
    },
    { key: 'nom', header: 'Élève', render: (r) => r.studentNom },
    { key: 'moyenne', header: 'Moyenne annuelle', align: 'right', render: (r) => r.moyenneAnnuelle.toFixed(2) },
    {
      key: 'mention',
      header: 'Mention',
      render: (r) => (r.diplomaMention ? <Badge tone="success">{MENTION_LABEL[r.diplomaMention]}</Badge> : '—'),
    },
  ];
  const expCols: Column<Student>[] = [
    { key: 'nom', header: 'Élève', render: (s) => `${s.prenom} ${s.nom}` },
    { key: 'classe', header: 'Classe', render: (s) => s.classe },
  ];

  return (
    <div>
      <PageHeader
        title="Diplômés & Renvoyés"
        subtitle="Année scolaire en cours. Diplômés de fin de cycle (CM2 / 3ème / Terminale) et élèves renvoyés."
        action={
          <Button variant="primary" disabled={selected.size === 0} onClick={openTransfer}>
            ⇄ Transférer la sélection{selected.size ? ` (${selected.size})` : ''}
          </Button>
        }
      />

      {done !== null ? (
        <p style={{ color: 'var(--color-success, green)', fontSize: 13 }}>
          {done} transfert{done > 1 ? 's' : ''} initié{done > 1 ? 's' : ''}. Suivez-les dans « Transferts ».
        </p>
      ) : null}

      <Card>
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Diplômés</h3>
          <StateView
            loading={graduates.isLoading}
            error={graduates.error}
            onRetry={() => graduates.refetch()}
            empty={rows.length === 0}
            emptyLabel="Aucun diplômé enregistré pour cette année."
          >
            <Table columns={gradCols} rows={rows} rowKey={(r) => r.id} />
          </StateView>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card>
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Renvoyés</h3>
          <StateView
            loading={expelled.isLoading}
            error={expelled.error}
            onRetry={() => expelled.refetch()}
            empty={expelled.data?.length === 0}
            emptyLabel="Aucun élève renvoyé."
          >
            <Table columns={expCols} rows={expelled.data ?? []} rowKey={(s) => s.id} />
          </StateView>
        </div>
      </Card>

      <Sheet
        title={`Transférer ${selected.size} diplômé${selected.size > 1 ? 's' : ''}`}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTransferOpen(false)}>Annuler</Button>
            <Button variant="primary" loading={transferMutation.isPending} onClick={submitTransfer}>Transférer</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Destination">
            <Select value={mode} onChange={(e) => { setMode(e.target.value as 'platform' | 'offplatform'); setErr(null); }}>
              <option value="platform">École sur SenÉtude (plateforme)</option>
              <option value="offplatform">École hors plateforme</option>
            </Select>
          </Field>

          {mode === 'platform' ? (
            <>
              <Field label="Indicatif de l'école de destination">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input value={indicatif} onChange={(e) => { setIndicatif(e.target.value); setDestSchool(null); }} placeholder="Ex. CEMT-LG" />
                  <Button variant="secondary" loading={resolveMutation.isPending} disabled={!indicatif.trim()} onClick={() => resolveMutation.mutate()}>
                    Rechercher
                  </Button>
                </div>
              </Field>
              {destSchool ? (
                <p style={{ fontSize: 13, margin: 0 }}>
                  École trouvée : <strong>{destSchool.name ?? indicatif}</strong>. L'école de destination devra accepter la demande.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <Field label="Nom de l'école (hors plateforme)" required>
                <Input value={offName} onChange={(e) => setOffName(e.target.value)} />
              </Field>
              <Field label="Région">
                <Input value={offRegion} onChange={(e) => setOffRegion(e.target.value)} />
              </Field>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: 0 }}>
                Un dossier (ZIP) + certificat de sortie sera produit pour chaque élève — à remettre à la famille.
              </p>
            </>
          )}

          <Field label="Motif (optionnel)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. Passage au lycée" />
          </Field>

          {err ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{err}</p> : null}
        </div>
      </Sheet>
    </div>
  );
}
