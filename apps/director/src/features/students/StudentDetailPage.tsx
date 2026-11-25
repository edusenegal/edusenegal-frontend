import { useEffect, useState, type ReactNode } from 'react';
import { fmtPct } from '@/utils/format';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Select, Sheet, StateView, useConfirm } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { Mention } from '@/types/domain';
import { PersonalDocumentsSection } from '@/components/documents/PersonalDocumentsSection';
import { StudentEditSheet } from './StudentEditSheet';
import { StudentGradesTab } from './StudentGradesTab';
import styles from './StudentDetailPage.module.css';

const STATUS_TONE = { actif: 'success', suspendu: 'danger', transfere: 'neutral' } as const;
const STATUS_LABEL = { actif: 'Actif', suspendu: 'Suspendu', transfere: 'Transféré' } as const;

export default function StudentDetailPage() {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const { students, classes, academicResults, paymentConfig } = useServices();
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

  // Fin de cycle (CM2/3ème/Terminale) : saisie Diplômé/mention, à tout moment.
  const isTerminalClass = !!s && /terminale|\btle\b|cm2|3\s*[eè]me?|\b3e\b/i.test(s.classe ?? '');
  const [diplome, setDiplome] = useState(false);
  const [mention, setMention] = useState<Mention>('passable');
  const yearResultQuery = useQuery({
    queryKey: ['student-year-result', studentId],
    queryFn: () => academicResults.getStudentYearResult(studentId),
    enabled: !!s && isTerminalClass,
  });
  useEffect(() => {
    const yr = yearResultQuery.data;
    if (!yr) return;
    setDiplome(yr.diplome ?? false);
    if (yr.diplomaMention) setMention(yr.diplomaMention);
  }, [yearResultQuery.data]);
  const diplomaMutation = useMutation({
    mutationFn: () => academicResults.setDiploma(studentId, s?.classeId ?? '', { diplome, diplomaMention: diplome ? mention : null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student-year-result', studentId] }),
  });

  // Données dynamiques de la fiche (demande explicite : plus de 0 figé).
  // Moyenne : academic-service (dernier semestre calculé — « — » si pas encore
  // disponible). Absences/retards : pointages réels (attendance-service).
  // Taux de paiement : payment-service (par élève).
  const marksQuery = useQuery({
    queryKey: ['student-marks', studentId],
    queryFn: () => students.getAttendanceMarks(studentId),
    enabled: !!s,
  });
  const averageQuery = useQuery({
    queryKey: ['student-average', studentId, s?.classeId ?? ''],
    queryFn: () => academicResults.getStudentAverage(studentId, s?.classeId ?? ''),
    enabled: !!s?.classeId,
  });
  const rateQuery = useQuery({
    queryKey: ['student-rate', studentId, s?.classeId ?? ''],
    queryFn: () => paymentConfig.getPaymentRatesForStudents([studentId], s?.classeId || undefined),
    enabled: !!s,
  });

  // Parents/tuteurs réels (noms + téléphones) — demande direction : la fiche
  // n'affichait qu'un décompte « N parent(s) lié(s) ». On lit ici chaque
  // compte PARENT rattaché (`parentIds`) pour montrer nom et téléphone.
  const parentsQuery = useQuery({
    queryKey: ['student-parents', studentId],
    queryFn: () => students.getParents(studentId),
    enabled: !!s,
  });

  const moyenneLabel = averageQuery.isLoading
    ? '…'
    : typeof averageQuery.data === 'number'
      ? `${averageQuery.data.toFixed(1)}/20`
      : '—';
  const absencesLabel = marksQuery.isLoading ? '…' : String(marksQuery.data?.absent ?? 0);
  const retardsLabel = marksQuery.isLoading ? '…' : String(marksQuery.data?.late ?? 0);
  const rate = rateQuery.data?.[studentId];
  const tauxLabel = rateQuery.isLoading ? '…' : typeof rate === 'number' ? `${fmtPct(rate)}%` : '—';

  const parents = parentsQuery.data ?? [];
  const parentsLabel: ReactNode = parentsQuery.isLoading
    ? '…'
    : parents.length > 0
      ? (
          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}>
            {parents.map((pt) => (
              <span key={pt.id}>
                {pt.prenom} {pt.nom} — {pt.tel}
              </span>
            ))}
          </span>
        )
      : s?.parent ?? '—';

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

  // Blocage / déblocage (demande explicite direction) : un compte bloqué ne
  // peut plus se connecter — un message dédié le lui indique à la tentative de
  // connexion (voir la passerelle + LoginPage). `statut === 'suspendu'` reflète
  // `accountStatus = SUSPENDED` côté backend.
  const blockMutation = useMutation({
    mutationFn: (blocked: boolean) => (blocked ? students.block(studentId) : students.unblock(studentId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-page'] });
    },
  });

  const expelMutation = useMutation({
    mutationFn: () => students.expel(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-page'] });
    },
  });

  async function onToggleBlock() {
    if (!s) return;
    const willBlock = s.statut !== 'suspendu';
    const msg = willBlock
      ? `Bloquer ${s.prenom} ${s.nom} ? L’élève ne pourra plus se connecter tant qu’il n’est pas débloqué.`
      : `Débloquer ${s.prenom} ${s.nom} ? L’accès à son compte sera rétabli.`;
    if (await confirm({ title: willBlock ? 'Bloquer l’élève' : 'Débloquer l’élève', message: msg, danger: willBlock })) {
      blockMutation.mutate(willBlock);
    }
  }

  async function onExpel() {
    if (!s) return;
    const msg = `Renvoyer ${s.prenom} ${s.nom} ? L’élève sera exclu de l’établissement (renvoyé) et ne pourra plus se connecter. Il apparaîtra dans la liste des renvoyés de l’année.`;
    if (await confirm({ title: 'Renvoyer l’élève', message: msg, danger: true })) {
      expelMutation.mutate();
    }
  }

  function onTransfer() {
    if (!s) return;
    navigate('/transferts', { state: { studentId: s.id } });
  }

  return (
    <div>
      <button
        type="button"
        className={styles.back}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
        onClick={() => navigate(-1)}
      >
        ← Retour
      </button>
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
            <Button
              variant="secondary"
              onClick={onToggleBlock}
              disabled={!s}
              loading={blockMutation.isPending}
            >
              {s?.statut === 'suspendu' ? '✓ Débloquer' : '⊘ Bloquer'}
            </Button>
            <Button
              variant="secondary"
              onClick={onExpel}
              disabled={!s || s?.statut === 'transfere'}
              loading={expelMutation.isPending}
            >
              ⚠ Renvoyer
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
                {isTerminalClass ? (
                  <Card>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ fontWeight: 600 }}>Diplôme de fin de cycle</div>
                      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                        Classe d'examen ({s.classe}). Renseignez le résultat de l'examen national (CFEE / BFEM / BAC).
                        Un élève non diplômé redouble, même avec une moyenne ≥ 10.
                      </p>
                      <Field label="Diplômé ?">
                        <Select value={diplome ? 'oui' : 'non'} onChange={(e) => setDiplome(e.target.value === 'oui')}>
                          <option value="non">Non</option>
                          <option value="oui">Oui</option>
                        </Select>
                      </Field>
                      {diplome ? (
                        <Field label="Mention">
                          <Select value={mention} onChange={(e) => setMention(e.target.value as Mention)}>
                            <option value="passable">Passable</option>
                            <option value="assez_bien">Assez bien</option>
                            <option value="bien">Bien</option>
                            <option value="tres_bien">Très bien</option>
                            <option value="excellent">Excellent</option>
                          </Select>
                        </Field>
                      ) : null}
                      <div>
                        <Button variant="primary" loading={diplomaMutation.isPending} onClick={() => diplomaMutation.mutate()}>
                          Enregistrer le diplôme
                        </Button>
                      </div>
                    </div>
                  </Card>
                ) : null}
                <Card>
                  <div className={styles.body}>
                    <div className={styles.rows}>
                      <Row k="Prénom" v={s.prenom} />
                      <Row k="Nom" v={s.nom} />
                      <Row k="Classe" v={s.classe} />
                      <Row k="Sexe" v={s.sexe === 'F' ? 'Féminin' : 'Masculin'} />
                      <Row k="Date de naissance" v={s.dateNaissance} />
                      <Row k="Parent / tuteur" v={parentsLabel} />
                      <Row k="Téléphone" v={s.tel} />
                      <Row k="Statut" v={<Badge tone={STATUS_TONE[s.statut]}>{STATUS_LABEL[s.statut]}</Badge>} />
                      <Row k="Moyenne" v={moyenneLabel} />
                      <Row k="Absences" v={absencesLabel} />
                      <Row k="Retards" v={retardsLabel} />
                      <Row k="Taux de paiement" v={tauxLabel} />
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
