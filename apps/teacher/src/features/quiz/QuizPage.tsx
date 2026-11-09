import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Input, Select, StateView, Table, Textarea, type Column, useConfirm } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { Quiz } from '@/types/domain';

const STATUS_TONE = { en_cours: 'warning', prete: 'success', echouee: 'danger' } as const;
const STATUS_LABEL = { en_cours: 'Génération en cours', prete: 'Prêt', echouee: 'Échec' } as const;

export default function QuizPage() {
  const { myClasses, subjects, quiz } = useServices();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'mine'], queryFn: () => subjects.listMine() });
  const list = useQuery({ queryKey: ['quiz', 'mine'], queryFn: () => quiz.mine(), refetchInterval: 8000 });

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [matiere, setMatiere] = useState('');
  const [sujet, setSujet] = useState('');
  const [nombreQuestions, setNombreQuestions] = useState(5);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['quiz', 'mine'] });
  }

  const generateMutation = useMutation({
    mutationFn: () => quiz.generate({ classId: classId || undefined, subjectId: subjectId || undefined, matiere: matiere.trim(), sujet: sujet.trim(), nombreQuestions }),
    onSuccess: () => {
      invalidate();
      setSujet('');
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Échec de la génération.'),
  });

  const publishMutation = useMutation({ mutationFn: (id: string) => quiz.publish(id), onSuccess: invalidate });
  const unpublishMutation = useMutation({ mutationFn: (id: string) => quiz.unpublish(id), onSuccess: invalidate });
  const removeMutation = useMutation({ mutationFn: (id: string) => quiz.remove(id), onSuccess: invalidate });

  function onSubmit() {
    if (!matiere.trim() || !sujet.trim()) {
      setError('La matière et le sujet sont obligatoires.');
      return;
    }
    generateMutation.mutate();
  }

  const columns: Column<Quiz>[] = [
    { key: 'titre', header: 'Titre', render: (q) => q.titre },
    { key: 'statut', header: 'Statut', render: (q) => <Badge tone={STATUS_TONE[q.statut]}>{STATUS_LABEL[q.statut]}</Badge> },
    { key: 'questions', header: 'Questions', render: (q) => String(q.nombreQuestions) },
    { key: 'tentatives', header: 'Tentatives', render: (q) => String(q.nombreTentatives) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (q) =>
        q.statut === 'prete' ? (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {q.publie ? (
              <Button variant="ghost" size="sm" onClick={() => unpublishMutation.mutate(q.id)}>
                Dépublier
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => publishMutation.mutate(q.id)}>
                Publier
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { void confirm({ title: 'Supprimer le quiz', message: 'Supprimer définitivement ce quiz ?', danger: true }).then((ok) => { if (ok) removeMutation.mutate(q.id); }); }}>
              Supprimer
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => { void confirm({ title: 'Supprimer le quiz', message: 'Supprimer définitivement ce quiz ?', danger: true }).then((ok) => { if (ok) removeMutation.mutate(q.id); }); }}>
            Supprimer
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Quiz IA" subtitle="Générez un quiz de révision à partir d’un sujet ou d’un texte de cours." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Nouveau quiz" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Classe">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 170 }}>
              <option value="">Aucune</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Matière (catalogue)">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: 170 }}>
              <option value="">Aucune</option>
              {(subjectsQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nom de la matière" required>
            <Input value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="Ex. Mathématiques" style={{ width: 180 }} />
          </Field>
          <Field label="Sujet / thème" required>
            <Textarea rows={1} value={sujet} onChange={(e) => setSujet(e.target.value)} style={{ width: 260 }} />
          </Field>
          <Field label="Nombre de questions">
            <Input type="number" min={3} max={20} value={nombreQuestions} onChange={(e) => setNombreQuestions(Number(e.target.value))} style={{ width: 90 }} />
          </Field>
          <Button variant="primary" size="sm" loading={generateMutation.isPending} onClick={onSubmit}>
            Générer
          </Button>
        </div>
        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{error}</p> : null}
      </Card>

      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(q) => q.id} />
        </StateView>
      </Card>
    </div>
  );
}
