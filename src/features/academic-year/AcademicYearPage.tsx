import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';

const STATUS_TONE = { ouverte: 'success', cloturee: 'neutral', planifiee: 'info' } as const;
const STATUS_LABEL = { ouverte: 'Ouverte', cloturee: 'Clôturée', planifiee: 'Planifiée' } as const;

export default function AcademicYearPage() {
  const { school } = useServices();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const years = useQuery({ queryKey: ['academic-years'], queryFn: () => school.listAcademicYears() });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const closeMutation = useMutation({
    mutationFn: (yearId: string) => school.closeAcademicYear(yearId),
    onSuccess: (year) => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setSuccess(`Année scolaire ${year.label} clôturée.`);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Clôture impossible.'),
  });

  return (
    <div>
      <PageHeader
        title="Année scolaire"
        subtitle="Historique des années scolaires et ouverture d’une nouvelle année."
        action={<Button variant="primary" onClick={() => navigate('/annee-scolaire/ouvrir')}>+ Ouvrir une nouvelle année scolaire</Button>}
      />

      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</p> : null}
      {success ? <p style={{ color: 'var(--color-success)', fontSize: 13, marginBottom: 12 }}>{success}</p> : null}

      <Card>
        <CardHeader title="Historique" />
        <StateView loading={years.isLoading} error={years.error} empty={years.data?.length === 0}>
          <div style={{ padding: '4px 0' }}>
            {years.data?.map((y) => (
              <div
                key={y.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <strong>{y.label}</strong>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                    {y.dateDebut} → {y.dateFin}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge tone={STATUS_TONE[y.statut]}>{STATUS_LABEL[y.statut]}</Badge>
                  {y.statut === 'ouverte' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={closeMutation.isPending && closeMutation.variables === y.id}
                      onClick={() => {
                        if (confirm(`Clôturer l’année scolaire ${y.label} ? Cette action est définitive.`)) {
                          closeMutation.mutate(y.id);
                        }
                      }}
                    >
                      Clôturer
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </StateView>
      </Card>
    </div>
  );
}
