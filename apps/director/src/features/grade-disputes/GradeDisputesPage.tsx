import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Sheet, StateView, Table, Textarea, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { GradeDispute } from '@/types/domain';

/**
 * Réclamations de notes (demande explicite) — niveau directeur uniquement.
 *
 * Seul le professeur concerné peut effectivement corriger une note (voir
 * `GradeDisputeService`, côté backend) : le directeur ne fait ici que
 * rejeter la réclamation (la note est maintenue) ou renvoyer une directive
 * de correction au professeur, qui reste seul à l'appliquer.
 */
export default function GradeDisputesPage() {
  const { gradeDisputes } = useServices();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<{ dispute: GradeDispute; action: 'reject' | 'order_correction' } | null>(null);
  const [comment, setComment] = useState('');

  const list = useQuery({ queryKey: ['grade-disputes', 'pending-director'], queryFn: () => gradeDisputes.listPendingDirector() });

  const decideMutation = useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: 'reject' | 'order_correction'; comment: string }) =>
      gradeDisputes.decide(id, action, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-disputes', 'pending-director'] });
      closeSheet();
    },
  });

  function closeSheet() {
    setTarget(null);
    setComment('');
  }

  function onConfirm() {
    if (!target) return;
    decideMutation.mutate({ id: target.dispute.id, action: target.action, comment });
  }

  const columns: Column<GradeDispute>[] = [
    { key: 'eleve', header: 'Élève', render: (d) => d.studentNom },
    { key: 'matiere', header: 'Matière', render: (d) => d.subjectNom },
    { key: 'professeur', header: 'Professeur', render: (d) => d.teacherNom },
    {
      key: 'note',
      header: 'Note contestée',
      render: (d) => (
        <span>
          {d.disputedValue}/20
          {d.currentValue != null && d.currentValue !== d.disputedValue ? (
            <span style={{ color: 'var(--color-text-faint)' }}> → {d.currentValue}/20</span>
          ) : null}
        </span>
      ),
    },
    { key: 'motif', header: 'Motif élève', render: (d) => d.reason },
    { key: 'statut', header: 'Statut', render: () => <Badge tone="warning">En attente du directeur</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (d) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={() => setTarget({ dispute: d, action: 'order_correction' })}>
            Demander correction au professeur
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setTarget({ dispute: d, action: 'reject' })}>
            Rejeter
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Réclamations de notes"
        subtitle="Réclamations escaladées par le surveillant général/censeur, en attente d'une décision finale."
      />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(d) => d.id} />
        </StateView>
      </Card>

      <Sheet
        title={target?.action === 'reject' ? 'Rejeter la réclamation' : 'Demander une correction au professeur'}
        open={target !== null}
        onClose={closeSheet}
        footer={
          <>
            <Button variant="secondary" onClick={closeSheet}>
              Annuler
            </Button>
            <Button variant="primary" loading={decideMutation.isPending} onClick={onConfirm}>
              Confirmer
            </Button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>
          {target?.action === 'reject'
            ? 'La note est maintenue et la réclamation est close. L’élève est notifié.'
            : 'Le professeur reçoit une directive à examiner — il reste le seul à pouvoir modifier effectivement la note.'}
        </p>
        <Field label="Commentaire" hint="Visible dans l'historique de la réclamation.">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Motif de la décision…" />
        </Field>
      </Sheet>
    </div>
  );
}
