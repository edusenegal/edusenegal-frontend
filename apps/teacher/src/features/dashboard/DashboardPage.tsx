import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, StateView, StatTile } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { frToISO, todayISO } from '@/utils/format';

/**
 * Pas d'agrégat dédié côté backend pour l'enseignant (contrairement à
 * `apps/director`'s `DashboardPort`, task #236) — composé ici depuis les
 * ports déjà réels : classes, examens à venir, réclamations et notifications.
 */
export default function DashboardPage() {
  const { myClasses, exams, gradeDisputes, notifications } = useServices();

  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });
  const disputesQuery = useQuery({ queryKey: ['grade-disputes', 'pending'], queryFn: () => gradeDisputes.listPending() });
  const unreadQuery = useQuery({ queryKey: ['notifications', 'unread-count'], queryFn: () => notifications.unreadCount() });

  const classIds = classesQuery.data?.map((c) => c.id) ?? [];
  const examsQuery = useQuery({
    queryKey: ['exams', 'upcoming', classIds],
    queryFn: async () => {
      const lists = await Promise.all(classIds.map((id) => exams.listForClass(id)));
      const today = todayISO();
      return lists.flat().filter((e) => frToISO(e.date) >= today).length;
    },
    enabled: classIds.length > 0,
  });

  // Seules les classes sont critiques pour ce bandeau (nb de classes + élèves).
  // Les autres tuiles (examens, litiges, notifs) ont déjà un repli (« — » / 0),
  // donc l'échec transitoire d'un de ces services ne doit PAS masquer tout le
  // tableau de bord — on ne lie l'état d'écran qu'à la requête des classes.
  const loading = classesQuery.isLoading;
  const error = classesQuery.error;
  const classes = classesQuery.data ?? [];
  const elevesCount = classes.reduce((sum, c) => sum + c.effectif, 0);

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue d’ensemble de vos classes pour l’année en cours." />
      <StateView loading={loading} error={error} onRetry={() => classesQuery.refetch()}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <StatTile label="Mes classes" value={String(classes.length)} />
          <StatTile label="Élèves" value={String(elevesCount)} />
          <StatTile
            label="Devoirs/examens à venir"
            value={examsQuery.data != null ? String(examsQuery.data) : '—'}
          />
          <StatTile
            label="Réclamations en attente"
            value={String(disputesQuery.data?.length ?? 0)}
            tone={(disputesQuery.data?.length ?? 0) > 0 ? 'warning' : 'success'}
          />
          <StatTile
            label="Notifications non lues"
            value={String(unreadQuery.data ?? 0)}
            tone={(unreadQuery.data ?? 0) > 0 ? 'warning' : 'neutral'}
          />
        </div>
      </StateView>

      <Card padded style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Mes classes</h2>
        <StateView loading={classesQuery.isLoading} error={classesQuery.error} empty={classes.length === 0}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {classes.map((c) => (
              <div
                key={c.id}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--color-border)' }}
              >
                <span>
                  {c.nom} {c.estPrincipal ? '— Professeur principal' : ''}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>{c.effectif} élève(s)</span>
              </div>
            ))}
          </div>
        </StateView>
      </Card>
    </div>
  );
}
