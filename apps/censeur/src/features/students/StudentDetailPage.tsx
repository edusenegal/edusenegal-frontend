import { useState, type ReactNode } from 'react';
import { fmtPct } from '@/utils/format';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Select, Sheet, StateView, useConfirm } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { PersonalDocumentsSection } from '@/components/documents/PersonalDocumentsSection';
import { StudentEditSheet } from './StudentEditSheet';
import { StudentGradesTab } from './StudentGradesTab';
import styles from './StudentDetailPage.module.css';

const STATUS_TONE = { actif: 'success', suspendu: 'danger', transfere: 'neutral' } as const;
const STATUS_LABEL = { actif: 'Actif', suspendu: 'Suspendu', transfere: 'Transféré' } as const;

export default function StudentDetailPage() {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const { students, classes } = useServices();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<'infos' | 'notes'>('infos');
  // Assignation de classe (nouvelle demande direction) — un élève créé sans
  // classe depuis la liste « Élèves » (voir `StudentFormSheet`) se la voit
  // assigner ici, sans passer par l'assistant de transfert interne (prévu
  // pour déplacer un élève d'une classe VERS une autre, pas pour en poser
  // une première — voir `TransfersPage`).
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignClassId, setAssignClassId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  const studentQuery = useQuery({ queryKey: ['student', studentId], queryFn: () => students.get(studentId) });
  const s = studentQuery.data;

  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list(), enabled: assignOpen });

  const assignMutation = useMutation({
    mutationFn: (classId: string) => classes.enroll(classId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-page'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['class', assignClassId] });
      setAssignOpen(false);
      setAssignClassId('');
      setAssignError(null);
    },
    onError: (err: unknown) => {
      setAssignError(err instanceof AppError ? err.message : "Impossible d'assigner cette classe.");
    },
  });

  function onAssign() {
    if (!assignClassId) {
      setAssignError('Choisissez une classe.');
      return;
    }
    setAssignError(null);
    assignMutation.mutate(assignClassId);
  }

  const removeMutation = useMutation({
    mutationFn: () => students.remove(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      // Même correction que `StudentFormSheet`/`StudentEditSheet`.
      queryClient.invalidateQueries({ queryKey: ['students-page'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      navigate('/eleves');
    },
  });

  async function onDelete() {
    if (!s) return;
    if (
      await confirm({
        title: 'Supprimer l’élève',
        message: `Supprimer ${s.prenom} ${s.nom} de l’établissement ? Cette action est définitive.`,
        danger: true,
      })
    ) {
      removeMutation.mutate();
    }
  }

  function onTransfer() {
    if (!s) return;
    navigate('/transferts', { state: { studentId: s.id } });
  }

  return (
    <div>
      <Link to="/eleves" className={styles.back}>
        ← Élèves
      </Link>
      <PageHeader
        title={s ? `${s.prenom} ${s.nom}` : '…'}
        subtitle={s ? `${s.classe} · ${STATUS_LABEL[s.statut]}` : undefined}
        action={
          <div className={styles.actions}>
            {s && !s.classeId ? (
              <Button variant="primary" onClick={() => setAssignOpen(true)}>
                + Assigner une classe
              </Button>
            ) : (
              <Button variant="secondary" onClick={onTransfer} disabled={!s}>
                ⇄ Transférer
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEditOpen(true)} disabled={!s}>
              ✎ Modifier
            </Button>
            <Button variant="ghost" onClick={onDelete} disabled={!s} loading={removeMutation.isPending}>
              ✕ Supprimer
            </Button>
          </div>
        }
      />

      <StateView loading={studentQuery.isLoading} error={studentQuery.error}>
        {s ? (
          <>
            <div className={styles.tabs} role="tablist" aria-label="Sections de la fiche">
              <button
                role="tab"
                aria-selected={tab === 'infos'}
                className={tab === 'infos' ? styles.tabOn : styles.tab}
                onClick={() => setTab('infos')}
              >
                Informations
              </button>
              <button
                role="tab"
                aria-selected={tab === 'notes'}
                className={tab === 'notes' ? styles.tabOn : styles.tab}
                onClick={() => setTab('notes')}
              >
                Notes
              </button>
            </div>

            {tab === 'notes' ? (
              <StudentGradesTab studentId={s.id} />
            ) : (
              <>
                <Card>
                  <div className={styles.body}>
                    <div className={styles.rows}>
                      <Row k="Prénom" v={s.prenom} />
                      <Row k="Nom" v={s.nom} />
                      <Row k="Classe" v={s.classe} />
                      <Row k="Sexe" v={s.sexe === 'F' ? 'Féminin' : 'Masculin'} />
                      <Row k="Date de naissance" v={s.dateNaissance} />
                      <Row k="Parent / tuteur" v={s.parent} />
                      <Row k="Téléphone" v={s.tel} />
                      <Row k="Statut" v={<Badge tone={STATUS_TONE[s.statut]}>{STATUS_LABEL[s.statut]}</Badge>} />
                      <Row k="Moyenne" v={`${s.moyenne.toFixed(1)}/20`} />
                      <Row k="Absences" v={String(s.absences)} />
                      <Row k="Retards" v={String(s.retards)} />
                      <Row k="Taux de paiement" v={`${fmtPct(s.tauxPaiement)}%`} />
                    </div>
                  </div>
                </Card>

                <Card style={{ marginTop: 'var(--space-md)' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Pièces personnelles</h3>
                  <p className={styles.muted} style={{ fontSize: 12.5, margin: '0 0 10px' }}>
                    CNI de l’élève, acte de naissance, CNI des parents.
                  </p>
                  <PersonalDocumentsSection ownerId={s.id} ownerType="eleve" />
                </Card>
              </>
            )}
          </>
        ) : null}
      </StateView>

      <StudentEditSheet open={editOpen} onClose={() => setEditOpen(false)} student={s ?? null} />

      <Sheet
        title="Assigner une classe"
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={onAssign} loading={assignMutation.isPending}>
              Assigner
            </Button>
          </>
        }
      >
        <Field label="Classe" required>
          <Select value={assignClassId} onChange={(e) => setAssignClassId(e.target.value)}>
            <option value="">— Choisir une classe —</option>
            {classList.data?.map((c) => (
              <option key={c.id} value={c.id} disabled={c.effectif >= c.capacite}>
                {c.name} ({c.effectif}/{c.capacite}
                {c.effectif >= c.capacite ? ' — complète' : ''})
              </option>
            ))}
          </Select>
        </Field>
        {assignError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{assignError}</p> : null}
      </Sheet>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.muted}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
