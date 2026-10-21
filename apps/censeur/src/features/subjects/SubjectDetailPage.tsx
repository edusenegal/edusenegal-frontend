import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { SubjectCoefficient } from '@/types/domain';
import { CourseDocumentsSection } from '@/components/documents/CourseDocumentsSection';
import styles from './SubjectDetailPage.module.css';

interface DraftRow extends SubjectCoefficient {
  className: string;
}

export default function SubjectDetailPage() {
  const { subjectId = '' } = useParams();
  const navigate = useNavigate();
  const { subjects, classes } = useServices();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DraftRow[]>([]);

  const subjectQuery = useQuery({ queryKey: ['subject', subjectId], queryFn: () => subjects.get(subjectId) });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const s = subjectQuery.data;

  // Le brouillon part des coefficients enregistrés, dans l'ordre des classes
  // de l'établissement — reconstruit à chaque chargement de la matière ou de
  // la liste des classes, pas à chaque frappe.
  useEffect(() => {
    if (!s || !classList.data) return;
    setDraft(
      classList.data.map((c) => {
        const existing = s.coefficients.find((co) => co.classeId === c.id);
        return {
          classeId: c.id,
          className: c.name,
          valeur: existing?.valeur ?? 0,
          enseignee: existing?.enseignee ?? false,
        };
      }),
    );
  }, [s, classList.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      subjects.setCoefficients(
        subjectId,
        draft.map(({ classeId, valeur, enseignee }) => ({ classeId, valeur, enseignee })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => subjects.remove(subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      navigate('/matieres');
    },
  });

  function onDelete() {
    if (!s) return;
    if (confirm(`Supprimer la matière « ${s.nom} » de l’établissement ?`)) removeMutation.mutate();
  }

  function updateRow(classeId: string, patch: Partial<Pick<DraftRow, 'valeur' | 'enseignee'>>) {
    setDraft((rows) => rows.map((r) => (r.classeId === classeId ? { ...r, ...patch } : r)));
  }

  const savedSignature = s
    ? JSON.stringify(
        [...s.coefficients]
          .map((c) => ({ classeId: c.classeId, valeur: c.valeur, enseignee: c.enseignee }))
          .sort((a, b) => a.classeId.localeCompare(b.classeId)),
      )
    : '';
  const draftSignature = JSON.stringify(
    [...draft]
      .map((r) => ({ classeId: r.classeId, valeur: r.valeur, enseignee: r.enseignee }))
      .sort((a, b) => a.classeId.localeCompare(b.classeId)),
  );
  const dirty = draft.length > 0 && savedSignature !== draftSignature;

  return (
    <div>
      <Link to="/matieres" className={styles.back}>
        ← Matières
      </Link>
      <PageHeader
        title={s?.nom ?? '…'}
        subtitle={s ? `${s.code} · ${s.global ? 'Catalogue global' : 'Matière de l’établissement'}${s.optionnelle ? ' · Optionnelle' : ''}` : undefined}
        action={
          s && !s.global ? (
            <Button variant="ghost" onClick={onDelete} loading={removeMutation.isPending}>
              ✕ Supprimer
            </Button>
          ) : undefined
        }
      />

      <StateView loading={subjectQuery.isLoading || classList.isLoading} error={subjectQuery.error}>
        <Card>
          <div className={styles.body}>
            <div className={styles.head}>
              <h3 className={styles.sectionTitle}>Coefficients par classe</h3>
              <Button variant="primary" size="sm" disabled={!dirty} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                Enregistrer
              </Button>
            </div>
            <p className={styles.hint}>
              Une classe non cochée « Enseignée » n’offre pas cette matière. Un coefficient à 0 sur une classe enseignée
              indique une matière facultative (sans incidence sur la moyenne).
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Enseignée</th>
                  <th>Coefficient</th>
                </tr>
              </thead>
              <tbody>
                {draft.map((row) => (
                  <tr key={row.classeId}>
                    <td>{row.className}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.enseignee}
                        onChange={(e) =>
                          updateRow(row.classeId, {
                            enseignee: e.target.checked,
                            valeur: e.target.checked ? row.valeur : 0,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        className={styles.coefInput}
                        value={row.valeur}
                        disabled={!row.enseignee}
                        onChange={(e) => updateRow(row.classeId, { valeur: Math.max(0, Number(e.target.value) || 0) })}
                      />
                      {row.enseignee && row.valeur === 0 ? (
                        <Badge tone="neutral">Facultative</Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {s ? (
          <Card style={{ marginTop: 'var(--space-md)' }}>
            <div className={styles.body}>
              <div className={styles.head}>
                <h3 className={styles.sectionTitle}>Documents pédagogiques</h3>
              </div>
              <p className={styles.hint}>Cours, exercices, corrigés, sujets d’examen, ressources pour cette matière.</p>
              <CourseDocumentsSection subjectId={subjectId} />
            </div>
          </Card>
        ) : null}
      </StateView>
    </div>
  );
}
