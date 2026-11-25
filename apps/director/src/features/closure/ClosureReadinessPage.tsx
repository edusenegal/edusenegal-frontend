import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, StateView, Table, useConfirm, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { ClassClosureSummary, ClassGroup } from '@/types/domain';

/**
 * S2 — Tableau de bord de pré-clôture (« prêt à clôturer »).
 *
 * Par classe : effectif, décisions arrêtées (= résultats annuels calculés),
 * répartition promus / redoublants / diplômés / exclus. Une classe est prête
 * quand toutes ses décisions sont arrêtées (decisions ≥ effectif). L'école est
 * prête quand toutes les classes le sont. Le bouton de clôture des résultats
 * (`academicResults.closeResultsYear`) n'est actif que dans ce cas.
 */

interface Row {
  classId: string;
  name: string;
  effectif: number;
  summary: ClassClosureSummary | null;
}

export default function ClosureReadinessPage() {
  const { academicResults, classes } = useServices();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const readiness = useQuery({ queryKey: ['closure-readiness'], queryFn: () => academicResults.getClosureReadiness() });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const byId = new Map((readiness.data ?? []).map((s) => [s.classId, s] as const));
    return (classList.data ?? [])
      .map((c: ClassGroup) => ({
        classId: c.id,
        name: c.name,
        effectif: c.effectif,
        summary: byId.get(c.id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [readiness.data, classList.data]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.effectif += r.effectif;
        acc.decisions += r.summary?.decisions ?? 0;
        acc.promoted += r.summary?.promoted ?? 0;
        acc.retained += r.summary?.retained ?? 0;
        acc.graduated += r.summary?.graduated ?? 0;
        acc.excluded += r.summary?.excluded ?? 0;
        return acc;
      },
      { effectif: 0, decisions: 0, promoted: 0, retained: 0, graduated: 0, excluded: 0 },
    );
  }, [rows]);

  function classReady(r: Row): boolean {
    return r.effectif > 0 && (r.summary?.decisions ?? 0) >= r.effectif;
  }
  const allReady = rows.length > 0 && rows.every(classReady);

  const closeMutation = useMutation({
    mutationFn: () => academicResults.closeResultsYear(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closure-readiness'] });
      setSuccess('Résultats de l’année clôturés. Vous pouvez poursuivre avec la bascule vers la nouvelle année.');
      setError(null);
    },
    onError: (err: unknown) =>
      setError(err instanceof AppError ? err.message : err instanceof Error ? err.message : 'Clôture impossible.'),
  });

  const columns: Column<Row>[] = [
    { key: 'classe', header: 'Classe', render: (r) => <strong>{r.name}</strong> },
    { key: 'effectif', header: 'Effectif', align: 'right', render: (r) => r.effectif },
    {
      key: 'decisions',
      header: 'Décisions arrêtées',
      align: 'right',
      render: (r) => `${r.summary?.decisions ?? 0} / ${r.effectif}`,
    },
    { key: 'promus', header: 'Promus', align: 'right', render: (r) => r.summary?.promoted ?? 0 },
    { key: 'redoublants', header: 'Redoublants', align: 'right', render: (r) => r.summary?.retained ?? 0 },
    { key: 'diplomes', header: 'Diplômés', align: 'right', render: (r) => r.summary?.graduated ?? 0 },
    { key: 'exclus', header: 'Exclus', align: 'right', render: (r) => r.summary?.excluded ?? 0 },
    {
      key: 'etat',
      header: 'État',
      render: (r) =>
        classReady(r) ? (
          <Badge tone="success">Prête</Badge>
        ) : (
          <Badge tone="warning">En attente</Badge>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clôture de l’année"
        subtitle="Vérifiez que toutes les décisions de passage sont arrêtées avant de clôturer les résultats de l’année."
        action={
          <Button variant="ghost" onClick={() => navigate('/diplomes-renvoyes')}>
            Diplômés & renvoyés
          </Button>
        }
      />

      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</p> : null}
      {success ? <p style={{ color: 'var(--color-success)', fontSize: 13, marginBottom: 12 }}>{success}</p> : null}

      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            padding: '16px 24px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {allReady ? 'Toutes les classes sont prêtes.' : 'Certaines classes attendent encore des décisions.'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {totals.decisions} / {totals.effectif} décisions arrêtées · {totals.promoted} promus ·{' '}
              {totals.retained} redoublants · {totals.graduated} diplômés · {totals.excluded} exclus
            </div>
          </div>
          <Button
            variant="primary"
            disabled={!allReady}
            loading={closeMutation.isPending}
            onClick={async () => {
              if (
                await confirm({
                  title: 'Clôturer les résultats',
                  message:
                    'Clôturer les résultats de l’année arrête définitivement les décisions de passage. Continuer ?',
                  danger: true,
                })
              ) {
                closeMutation.mutate();
              }
            }}
          >
            Clôturer les résultats de l’année
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pré-clôture par classe" />
        <StateView
          loading={readiness.isLoading || classList.isLoading}
          error={readiness.error ?? classList.error}
          empty={rows.length === 0}
        >
          <Table columns={columns} rows={rows} rowKey={(r) => r.classId} />
        </StateView>
      </Card>
    </div>
  );
}
