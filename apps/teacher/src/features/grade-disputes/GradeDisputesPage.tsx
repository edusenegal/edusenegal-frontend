import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field, Input, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { GradeDispute, StudentRosterEntry } from '@/types/domain';

const TYPE_LABEL: Record<string, string> = {
  devoir1: 'Devoir 1',
  devoir2: 'Devoir 2',
  composition: 'Composition',
  interro: 'Interrogation',
  tp: 'TP',
  td: 'TD',
  devoir: 'Devoir',
  controle_continu: 'Contrôle continu',
  examen: 'Examen',
  projet: 'Projet',
  expose: 'Exposé',
  stage: 'Stage',
};

/** Code HTTP d'une violation de règle métier côté backend — voir `GlobalExceptionHandler.business`. */
const BUSINESS_RULE_STATUS = 422;

export default function GradeDisputesPage() {
  const { gradeDisputes, myClasses } = useServices();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['grade-disputes', 'pending'], queryFn: () => gradeDisputes.listPending() });

  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);

  // Élève/classe concernés — `GradeDispute` ne porte que des ids, résolus
  // ici via les classes/effectifs du professeur (demande explicite : les
  // voir dans la liste des réclamations). Best-effort par classe, comme le
  // reste de l'écran "aucune réclamation" reste affichable même si une
  // classe échoue à se résoudre.
  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });
  const classNameById = new Map((classesQuery.data ?? []).map((c) => [c.id, c.nom]));

  const disputeClassIds = useMemo(
    () => Array.from(new Set((list.data ?? []).map((d) => d.classId))),
    [list.data],
  );
  const rostersQuery = useQuery({
    queryKey: ['grade-disputes-rosters', disputeClassIds],
    queryFn: async () => {
      const entries = await Promise.all(
        disputeClassIds.map(async (classId) => {
          try {
            return [classId, await myClasses.roster(classId)] as const;
          } catch {
            return [classId, [] as StudentRosterEntry[]] as const;
          }
        }),
      );
      return new Map(entries);
    },
    enabled: disputeClassIds.length > 0,
  });

  function studentName(d: GradeDispute): string {
    const student = rostersQuery.data?.get(d.classId)?.find((s) => s.id === d.studentId);
    return student ? `${student.prenom} ${student.nom}` : d.studentId;
  }

  const decideMutation = useMutation({
    mutationFn: ({ id, approuve }: { id: string; approuve: boolean }) =>
      gradeDisputes.decide(id, {
        approuve,
        nouvelleValeur: approuve ? Number(newValues[id] ?? 0) : undefined,
      }),
    onSuccess: () => {
      setLockedMessage(null);
      queryClient.invalidateQueries({ queryKey: ['grade-disputes', 'pending'] });
    },
    onError: (e) => {
      // La note a été verrouillée entre l'affichage de la réclamation et la décision :
      // le backend refuse toute modification (voir GradeDispute.java, règle explicite).
      // On ne montre jamais le message technique du backend (voir services/errors.ts) —
      // seulement ce message dédié, clair pour le professeur, puis on rafraîchit la liste.
      if (e instanceof AppError && e.status === BUSINESS_RULE_STATUS) {
        setLockedMessage("Cette note a été verrouillée : la réclamation ne peut plus être traitée.");
        queryClient.invalidateQueries({ queryKey: ['grade-disputes', 'pending'] });
      }
    },
  });

  const columns: Column<GradeDispute>[] = [
    { key: 'eleve', header: 'Élève', render: (d) => studentName(d) },
    { key: 'classe', header: 'Classe', render: (d) => classNameById.get(d.classId) ?? d.classId },
    { key: 'matiere', header: 'Matière', render: (d) => d.subjectNom ?? '—' },
    { key: 'type', header: 'Évaluation', render: (d) => (d.type ? TYPE_LABEL[d.type] ?? d.type : '—') },
    { key: 'actuelle', header: 'Note actuelle', render: (d) => (d.valeurActuelle != null ? `${d.valeurActuelle}/20` : '—') },
    { key: 'contestee', header: 'Note contestée', render: (d) => `${d.valeurContestee}/20` },
    { key: 'motif', header: 'Motif', render: (d) => d.motif },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (d) => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
          <Field label="">
            <Input
              type="number"
              min={0}
              max={20}
              step={0.25}
              placeholder="Nouvelle note"
              value={newValues[d.id] ?? ''}
              onChange={(e) => setNewValues((prev) => ({ ...prev, [d.id]: e.target.value }))}
              style={{ width: 90 }}
            />
          </Field>
          <Button
            variant="secondary"
            size="sm"
            loading={decideMutation.isPending}
            onClick={() => decideMutation.mutate({ id: d.id, approuve: true })}
          >
            Approuver
          </Button>
          <Button variant="ghost" size="sm" onClick={() => decideMutation.mutate({ id: d.id, approuve: false })}>
            Rejeter
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Réclamations de notes" subtitle="Réclamations en attente de votre décision." />
      {lockedMessage ? (
        <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: '0 0 12px' }}>{lockedMessage}</p>
      ) : null}
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(d) => d.id} />
        </StateView>
      </Card>
    </div>
  );
}
