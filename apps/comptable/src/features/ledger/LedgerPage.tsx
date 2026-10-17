import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, StateView, StatTile } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF } from '@/utils/format';

export default function LedgerPage() {
  const { ledger } = useServices();

  const query = useQuery({ queryKey: ['ledger'], queryFn: () => ledger.get() });

  return (
    <div>
      <PageHeader
        title="Grand livre"
        subtitle="Solde courant de l'établissement — recalculé automatiquement à chaque encaissement élève et à chaque dépense validée."
      />

      <StateView loading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <StatTile label="Encaissements totaux" value={fmtXOF(query.data.totalEncaissements)} tone="success" />
              <StatTile label="Dépenses totales" value={fmtXOF(query.data.totalDepenses)} tone="warning" />
              <StatTile
                label="Solde"
                value={fmtXOF(query.data.solde)}
                tone={query.data.solde >= 0 ? 'success' : 'danger'}
              />
            </div>

            <Card style={{ marginTop: 12 }} padded>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                {query.data.derniereMajLe
                  ? `Dernière mise à jour : ${query.data.derniereMajLe}`
                  : "Aucun mouvement enregistré pour l'instant sur l'année en cours."}
              </p>
            </Card>
          </>
        ) : null}
      </StateView>
    </div>
  );
}
