import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, StateView, StatTile } from '@/components/ui';
import { useServices } from '@/hooks/useServices';

export default function DashboardPage() {
  const { library } = useServices();
  const navigate = useNavigate();
  const statsQuery = useQuery({ queryKey: ['library-stats'], queryFn: () => library.getStats() });
  const s = statsQuery.data;

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue d’ensemble de la bibliothèque." />

      <StateView loading={statsQuery.isLoading} error={statsQuery.error} onRetry={() => statsQuery.refetch()}>
        {s ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <StatTile label="Œuvres" value={String(s.totalWorks)} onClick={() => navigate('/catalogue')} />
            <StatTile label="Exemplaires" value={String(s.totalCopies)} />
            <StatTile label="Emprunts en cours" value={String(s.loansActive)} tone="success" onClick={() => navigate('/emprunts')} />
            <StatTile label="En retard" value={String(s.loansOverdue)} tone={s.loansOverdue > 0 ? 'danger' : 'success'} onClick={() => navigate('/retards')} />
            <StatTile label="Réservations" value={String(s.reservationsActive)} onClick={() => navigate('/reservations')} />
            <StatTile label="Adhérents actifs" value={String(s.membersActive)} onClick={() => navigate('/adherents')} />
          </div>
        ) : null}
      </StateView>

      <Card padded style={{ marginTop: 16 }}>
        <CardHeader title="Actions rapides" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => navigate('/emprunts')}>
            Nouvel emprunt
          </Button>
          <Button variant="secondary" onClick={() => navigate('/catalogue')}>
            Ajouter une œuvre
          </Button>
          <Button variant="secondary" onClick={() => navigate('/retards')}>
            Voir les retards
          </Button>
        </div>
      </Card>
    </div>
  );
}
