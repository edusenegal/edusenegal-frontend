import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Sheet,
  StateView,
  Table,
  Textarea,
  type Column,
} from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { exportCsv } from '@/utils/format';
import type { AssessmentType, Grade, StudentRosterEntry } from '@/types/domain';

/** Barème standard des notes — une note modifiée ne peut jamais le dépasser. */
const BAREME_STANDARD = 20;

const TYPE_LABEL: Record<AssessmentType, string> = {
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
/** Ordre d'affichage des colonnes — même ordre que `GradeEntryPage` (TYPES). */
const TYPE_ORDER = Object.keys(TYPE_LABEL) as AssessmentType[];

/** Clé stable pour l'état d'édition d'une cellule (une cellule = un élève × un type d'évaluation). */
function cellKey(studentId: string, type: string): string {
  return `${studentId}|${type}`;
}

export default function ClassGradesPage() {
  const { myClasses, subjects, grades } = useServices();
  const queryClient = useQueryClient();

  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'mine'], queryFn: () => subjects.listMine() });

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semestre, setSemestre] = useState(1);

  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [draftValeur, setDraftValeur] = useState('');
  const [draftCommentaire, setDraftCommentaire] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyGradeId, setHistoryGradeId] = useState<string | null>(null);

  const rosterQuery = useQuery({
    queryKey: ['roster', classId],
    queryFn: () => myClasses.roster(classId),
    enabled: classId !== '',
  });
  const gradesQuery = useQuery({
    queryKey: ['grades', classId, subjectId, semestre],
    queryFn: () => grades.listForClass(classId, subjectId, semestre),
    enabled: classId !== '' && subjectId !== '',
  });

  const historyQuery = useQuery({
    queryKey: ['grade-history', historyGradeId],
    queryFn: () => grades.history(historyGradeId as string),
    enabled: historyGradeId !== null,
  });

  const nameById = new Map((rosterQuery.data ?? []).map((s) => [s.id, `${s.prenom} ${s.nom}`]));
  const historyGrade = (gradesQuery.data ?? []).find((g) => g.id === historyGradeId) ?? null;

  // Pivot : une colonne par type d'évaluation RÉELLEMENT saisi pour cette
  // classe/matière/semestre (demande explicite) — si seul "devoir1" a été
  // saisi, une seule colonne "Devoir 1" apparaît ; dès que "devoir2" est
  // saisi, sa colonne apparaît à son tour, dans l'ordre canonique `TYPE_ORDER`.
  const presentTypes = useMemo(
    () => TYPE_ORDER.filter((t) => (gradesQuery.data ?? []).some((g) => g.type === t)),
    [gradesQuery.data],
  );
  const gradeByStudentAndType = useMemo(() => {
    const map = new Map<string, Map<string, Grade>>();
    for (const g of gradesQuery.data ?? []) {
      const byType = map.get(g.studentId) ?? new Map<string, Grade>();
      byType.set(g.type, g);
      map.set(g.studentId, byType);
    }
    return map;
  }, [gradesQuery.data]);

  function exportGrades() {
    const headers = ['Élève', ...presentTypes.map((t) => TYPE_LABEL[t] ?? t)];
    const rows = (rosterQuery.data ?? []).map((st) => [
      `${st.prenom} ${st.nom}`,
      ...presentTypes.map((t) => gradeByStudentAndType.get(st.id)?.get(t)?.valeur ?? ''),
    ]);
    const cname = classesQuery.data?.find((c) => c.id === classId)?.nom ?? 'classe';
    const sname = subjectsQuery.data?.find((sb) => sb.id === subjectId)?.nom ?? 'matiere';
    exportCsv(`notes_${cname}_${sname}_S${semestre}.csv`, headers, rows);
  }

  const updateMutation = useMutation({
    mutationFn: (input: { gradeId: string; valeur: number; commentaire?: string }) =>
      grades.update(input.gradeId, input.valeur, input.commentaire),
    onSuccess: () => {
      setEditingCellKey(null);
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ['grades', classId, subjectId, semestre] });
    },
    onError: (e) => setSaveError(e instanceof Error ? e.message : 'Échec de la modification.'),
  });

  function startEdit(g: Grade) {
    setEditingCellKey(cellKey(g.studentId, g.type));
    setDraftValeur(String(g.valeur));
    setDraftCommentaire(g.commentaire ?? '');
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingCellKey(null);
    setSaveError(null);
  }

  function saveEdit(g: Grade) {
    const n = Number(draftValeur);
    if (draftValeur === '' || Number.isNaN(n) || n < 0 || n > BAREME_STANDARD) {
      setSaveError(`La note doit être comprise entre 0 et ${BAREME_STANDARD}.`);
      return;
    }
    updateMutation.mutate({ gradeId: g.id, valeur: n, commentaire: draftCommentaire || undefined });
  }

  const columns: Column<StudentRosterEntry>[] = [
    { key: 'eleve', header: 'Élève', render: (s) => `${s.prenom} ${s.nom}` },
    ...presentTypes.map((type) => ({
      key: type,
      header: TYPE_LABEL[type] ?? type,
      render: (s: StudentRosterEntry) => {
        const g = gradeByStudentAndType.get(s.id)?.get(type);
        if (!g) return <span style={{ color: 'var(--color-text-faint)' }}>—</span>;
        const key = cellKey(s.id, type);
        if (editingCellKey === key) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
              <Input
                type="number"
                min={0}
                max={BAREME_STANDARD}
                step={0.25}
                value={draftValeur}
                onChange={(e) => setDraftValeur(e.target.value)}
                style={{ width: 80 }}
              />
              <Textarea
                rows={2}
                value={draftCommentaire}
                onChange={(e) => setDraftCommentaire(e.target.value)}
                placeholder="Commentaire (facultatif)"
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="primary" size="sm" loading={updateMutation.isPending} onClick={() => saveEdit(g)}>
                  Enregistrer
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  Annuler
                </Button>
              </div>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 140 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {g.valeur}/{BAREME_STANDARD}
              {g.verrouillee ? <Badge tone="neutral">Verrouillée</Badge> : null}
            </span>
            {g.commentaire ? (
              <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{g.commentaire}</span>
            ) : null}
            <div style={{ display: 'flex', gap: 4 }}>
              <Button variant="ghost" size="sm" disabled={g.verrouillee} onClick={() => startEdit(g)}>
                Modifier
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setHistoryGradeId(g.id)}>
                Historique
              </Button>
            </div>
          </div>
        );
      },
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Notes d’une classe"
        subtitle="Consultez et modifiez les notes déjà saisies pour une matière et un semestre."
        action={
          <Button
            variant="secondary"
            size="sm"
            disabled={!classId || !subjectId || (gradesQuery.data?.length ?? 0) === 0}
            onClick={exportGrades}
          >
            Exporter (CSV)
          </Button>
        }
      />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Filtre" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Classe">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 180 }}>
              <option value="">Choisir…</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Matière">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: 180 }}>
              <option value="">Choisir…</option>
              {(subjectsQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Semestre">
            <Select value={String(semestre)} onChange={(e) => setSemestre(Number(e.target.value))} style={{ width: 120 }}>
              {[1, 2, 3, 4].map((s) => (
                <option key={s} value={s}>
                  Semestre {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        {saveError ? <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: '0 0 8px' }}>{saveError}</p> : null}
        <StateView
          loading={gradesQuery.isLoading || rosterQuery.isLoading}
          error={gradesQuery.error ?? rosterQuery.error}
          empty={classId !== '' && subjectId !== '' && presentTypes.length === 0}
          emptyLabel="Aucune note saisie pour cette classe/matière/semestre — utilisez « Saisie des notes »."
        >
          <Table columns={columns} rows={rosterQuery.data ?? []} rowKey={(s) => s.id} />
        </StateView>
      </Card>

      <Sheet
        title="Historique de la note"
        open={historyGradeId !== null}
        onClose={() => setHistoryGradeId(null)}
        width="md"
      >
        {historyGrade ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
            {nameById.get(historyGrade.studentId) ?? historyGrade.studentId} — {TYPE_LABEL[historyGrade.type] ?? historyGrade.type}
          </p>
        ) : null}
        <StateView
          loading={historyQuery.isLoading}
          error={historyQuery.error}
          empty={historyQuery.data?.length === 0}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(historyQuery.data ?? []).map((h) => (
              <div key={h.id} style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Badge tone={h.action === 'entree' ? 'info' : 'warning'}>
                    {h.action === 'entree' ? 'Saisie' : 'Modification'}
                  </Badge>
                  <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                    {new Date(h.le).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p style={{ fontSize: 13, margin: '4px 0 0' }}>
                  {h.ancienneValeur != null ? `${h.ancienneValeur} → ${h.nouvelleValeur}` : `${h.nouvelleValeur}/${BAREME_STANDARD}`}
                  {' · '}
                  {h.acteurNom ?? h.acteurId}
                </p>
                {h.nouveauCommentaire ? (
                  <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                    Commentaire : {h.nouveauCommentaire}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </StateView>
      </Sheet>
    </div>
  );
}
