import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Select, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { LeaveRequest } from '@/types/domain';

const STATUS_TONE = { en_attente: 'warning', approuve: 'success', rejete: 'danger' } as const;
const STATUS_LABEL = { en_attente: 'En attente', approuve: 'Approuvé', rejete: 'Rejeté' } as const;

export default function LeavesPage() {
  const { leaves, teachers } = useServices();
  const queryClient = useQueryClient();
  const [reviewError, setReviewError] = useState<string | null>(null);
  /** Remplaçant choisi au moment de l'approbation, par demande de congé — seulement
   * utilisé quand la demande n'en proposait aucun elle-même (voir le select ajouté
   * dans la colonne actions ci-dessous). */
  const [chosenReplacement, setChosenReplacement] = useState<Record<string, string>>({});

  const list = useQuery({ queryKey: ['leaves'], queryFn: () => leaves.list() });
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list() });

  const reviewMutation = useMutation({
    mutationFn: ({ id, approve, remplacantId }: { id: string; approve: boolean; remplacantId?: string | null }) => {
      setReviewError(null);
      return leaves.review(id, approve, remplacantId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaves'] }),
    onError: (err: unknown) =>
      setReviewError(
        err instanceof AppError
          ? err.message
          : "Impossible d'enregistrer la décision. Réessaie.",
      ),
  });

  const columns: Column<LeaveRequest>[] = [
    { key: 'enseignant', header: 'Enseignant', render: (l) => l.teacherNom },
    { key: 'periode', header: 'Période', render: (l) => `${l.dateDebut} → ${l.dateFin}` },
    { key: 'motif', header: 'Motif', render: (l) => l.motif },
    { key: 'remplacant', header: 'Remplaçant', render: (l) => l.remplacant ?? '—' },
    {
      key: 'piece',
      header: 'Pièce jointe',
      render: (l) =>
        l.pieceJointe ? (
          <span title={l.pieceJointe.nom} style={{ fontSize: 12.5 }}>
            📎 {l.pieceJointe.nom}
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-faint)' }}>Aucune</span>
        ),
    },
    { key: 'statut', header: 'Statut', render: (l) => <Badge tone={STATUS_TONE[l.statut]}>{STATUS_LABEL[l.statut]}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (l) => {
        if (l.statut !== 'en_attente') return null;
        // CORRECTION (signalé) — « si je valide ça ne fait rien » : le
        // backend REFUSE l'approbation sans remplaçant
        // (BusinessException REPLACEMENT_REQUIRED, voir
        // ScheduleServiceImpl#reviewLeave), et la demande n'en a pas
        // toujours un (remplacementTeacherId est optionnel à la création).
        // Avant ce correctif le bouton "Approuver" ne pouvait ENVOYER que
        // le remplaçant déjà proposé par l'enseignant (souvent absent) —
        // le directeur n'avait aucun moyen d'en choisir un lui-même, donc
        // chaque tentative échouait silencieusement en apparence (l'erreur
        // s'affichait, mais sans dire pourquoi ni offrir de solution).
        const needsReplacement = !l.remplacantId;
        const chosenId = chosenReplacement[l.id] ?? '';
        const effectiveReplacementId = needsReplacement ? chosenId || null : l.remplacantId;
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
            {needsReplacement ? (
              <Select
                value={chosenId}
                onChange={(e) => setChosenReplacement((prev) => ({ ...prev, [l.id]: e.target.value }))}
                style={{ width: 170 }}
                aria-label="Choisir un remplaçant"
              >
                <option value="">Remplaçant…</option>
                {(teachersQuery.data ?? [])
                  .filter((t) => t.id !== l.teacherId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom}
                    </option>
                  ))}
              </Select>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              loading={reviewMutation.isPending}
              disabled={needsReplacement && !chosenId}
              title={needsReplacement && !chosenId ? 'Un remplaçant est requis pour approuver ce congé.' : undefined}
              onClick={() => reviewMutation.mutate({ id: l.id, approve: true, remplacantId: effectiveReplacementId })}
            >
              Approuver
            </Button>
            <Button variant="ghost" size="sm" onClick={() => reviewMutation.mutate({ id: l.id, approve: false })}>
              Rejeter
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader title="Congés & absences" subtitle="Demandes de congé du personnel, avec les pièces jointes transmises." />
      <Card>
        {reviewError ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 0 }}>{reviewError}</p> : null}
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(l) => l.id} />
        </StateView>
      </Card>
    </div>
  );
}
