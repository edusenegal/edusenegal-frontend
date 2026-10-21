import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Segmented, StateView, Table, type Column, type SegmentedOption } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { AbsenceRequestSummary, AbsenceReviewStatus } from '@/types/domain';
import styles from './AbsenceReviewPage.module.css';

const STATUS_TONE = { PENDING: 'warning', LOCKED: 'neutral', APPROVED: 'success', REJECTED: 'danger' } as const;
const STATUS_LABEL = { PENDING: 'En attente', LOCKED: 'Verrouillée', APPROVED: 'Approuvée', REJECTED: 'Rejetée' } as const;

type Filter = AbsenceReviewStatus | 'ALL';

const FILTER_OPTIONS: SegmentedOption<Filter>[] = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'LOCKED', label: 'Verrouillées' },
  { value: 'ALL', label: 'Toutes' },
];

/**
 * File de revue/verrouillage des absences élèves — item #402.
 *
 * Une absence est créée automatiquement dès que le professeur marque
 * l'élève absent (voir attendance-service) : tant qu'elle reste PENDING,
 * l'élève peut encore la justifier lui-même depuis son application.
 * Verrouiller («Verrouiller») l'en empêche définitivement ; seuls le
 * surveillant général, le censeur et le directeur peuvent le faire, et
 * eux seuls peuvent ensuite trancher (Approuver/Rejeter) depuis PENDING ou
 * LOCKED.
 */
export default function AbsenceReviewPage() {
  const { studentAttendance } = useServices();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [actionError, setActionError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['school-absences', filter],
    queryFn: () => studentAttendance.listSchoolAbsences(filter === 'ALL' ? undefined : filter),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' | 'LOCKED' }) => {
      setActionError(null);
      return studentAttendance.reviewAbsence(id, status);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['school-absences'] }),
    onError: (err: unknown) =>
      setActionError(err instanceof AppError ? err.message : "Impossible d'enregistrer la décision. Réessaie."),
  });

  const columns: Column<AbsenceRequestSummary>[] = [
    { key: 'eleve', header: 'Élève', render: (a) => a.studentNom },
    {
      key: 'periode',
      header: 'Période',
      render: (a) => (a.dateFrom === a.dateTo ? a.dateFrom : `${a.dateFrom} → ${a.dateTo}`),
    },
    {
      key: 'justification',
      header: 'Justification',
      render: (a) =>
        a.reason ? (
          <span>
            {a.reason} {a.hasJustification ? '📎' : null}
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-faint)' }}>Non justifiée</span>
        ),
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (a) => <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (a) =>
        a.status === 'APPROVED' || a.status === 'REJECTED' ? (
          <span style={{ color: 'var(--color-text-faint)' }}>Traitée{a.reviewedBy ? ` — ${a.reviewedBy}` : ''}</span>
        ) : (
          <div className={styles.actionRow}>
            {a.status === 'PENDING' ? (
              <Button
                variant="secondary"
                size="sm"
                loading={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ id: a.id, status: 'LOCKED' })}
              >
                Verrouiller
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              loading={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({ id: a.id, status: 'APPROVED' })}
            >
              Approuver
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({ id: a.id, status: 'REJECTED' })}
            >
              Rejeter
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div>
      <Link to="/presence" className={styles.back}>
        ← Présence & absences
      </Link>
      <PageHeader
        title="Absences à traiter"
        subtitle="Verrouiller empêche l'élève de justifier lui-même ; seuls le surveillant général, le censeur et le directeur peuvent trancher."
      />

      <div className={styles.toolbar}>
        <Segmented<Filter> options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
      </div>

      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      <StateView
        loading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        empty={list.data?.length === 0}
      >
        <Table columns={columns} rows={list.data ?? []} rowKey={(a) => a.id} />
      </StateView>
    </div>
  );
}
