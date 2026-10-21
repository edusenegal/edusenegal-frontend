import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, StateView, StatTile, Badge } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { dashboard, classes, leaves } = useServices();

  const snapshot = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboard.getSnapshot() });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  // Censeur/surveillant général : pas d'accès aux demandes de salaire
  // (endpoint réservé à DIRECTOR côté backend) — seules les demandes de
  // congé apparaissent dans « Demandes récentes » ci-dessous.
  const leaveList = useQuery({ queryKey: ['leaves'], queryFn: () => leaves.list() });

  const s = snapshot.data;

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue d’ensemble de l’établissement pour l’année en cours." />

      <StateView loading={snapshot.isLoading} error={snapshot.error} onRetry={() => snapshot.refetch()}>
        {s ? (
          <div className={styles.grid}>
            <StatTile label="Effectif total" value={String(s.effectifTotal)} delta={`${s.effectifGarcons} G · ${s.effectifFilles} F`} />
            <StatTile
              label="Présence du jour"
              value={`${s.presenceDuJour}%`}
              delta={`${s.presenceDuJourVariation > 0 ? '+' : ''}${s.presenceDuJourVariation} pt${Math.abs(s.presenceDuJourVariation) >= 2 ? 's' : ''} vs hier`}
              tone={s.presenceDuJourVariation >= 0 ? 'success' : 'danger'}
              onClick={() => navigate('/presence')}
            />
            <StatTile
              label="Demandes en attente"
              value={String(s.demandesEnAttente)}
              tone={s.demandesEnAttente > 0 ? 'warning' : 'success'}
            />
            <StatTile label="Classes" value={String(s.classesCount)} />
            <StatTile label="Enseignants" value={String(s.enseignantsCount)} />
          </div>
        ) : null}
      </StateView>

      <div className={styles.cols}>
        <Card>
          <CardHeader title="Classes — effectifs" />
          <StateView loading={classList.isLoading} error={classList.error} empty={classList.data?.length === 0}>
            <div className={styles.classRows}>
              {classList.data?.map((c) => (
                <div key={c.id} className={styles.classRow}>
                  <span className={styles.className}>{c.name}</span>
                  <span className={styles.classCount}>
                    {c.effectif}/{c.capacite} élèves
                  </span>
                </div>
              ))}
            </div>
          </StateView>
        </Card>

        <Card>
          <CardHeader title="Demandes récentes" />
          <StateView
            loading={leaveList.isLoading}
            error={leaveList.error}
            empty={(leaveList.data?.length ?? 0) === 0}
          >
            <div className={styles.requestRows}>
              {leaveList.data
                ?.filter((l) => l.statut === 'en_attente')
                .slice(0, 3)
                .map((l) => (
                  <div key={l.id} className={styles.requestRow}>
                    <span>Congé — {l.teacherNom}</span>
                    <Badge tone="warning">En attente</Badge>
                  </div>
                ))}
            </div>
          </StateView>
        </Card>
      </div>
    </div>
  );
}
