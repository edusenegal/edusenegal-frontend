import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Input, Segmented, Select, StateView, StatTile } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { StudentsTable } from '@/features/students/StudentsTable';
import { PlanEventSheet } from './PlanEventSheet';
import { ScheduleGrid } from './ScheduleGrid';
import styles from './ClassDetailPage.module.css';

type Tab = 'stats' | 'calendrier' | 'emploi';

const EVENT_TONE = {
  Devoir: 'info',
  Examen: 'danger',
  Composition: 'warning',
  'Conseil de classe': 'neutral',
} as const;

export default function ClassDetailPage() {
  const { classId = '' } = useParams();
  const navigate = useNavigate();
  const { classes, teachers, students: studentsPort } = useServices();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('stats');
  const [planOpen, setPlanOpen] = useState(false);
  const [homeroomDraft, setHomeroomDraft] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const classQuery = useQuery({ queryKey: ['class', classId], queryFn: () => classes.get(classId) });
  const teacherList = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list() });

  // Le brouillon suit la classe chargée (ou un changement de classe via la
  // navigation) sans écraser une sélection que le directeur est en train de
  // faire avant d'enregistrer.
  useEffect(() => {
    setHomeroomDraft(classQuery.data?.homeroomTeacherId ?? '');
  }, [classQuery.data?.id, classQuery.data?.homeroomTeacherId]);

  const homeroomMutation = useMutation({
    mutationFn: (teacherId: string) => classes.setHomeroomTeacher(classId, teacherId || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
  const roster = useQuery({ queryKey: ['students', classId], queryFn: () => studentsPort.list(classId) });
  const events = useQuery({
    queryKey: ['class-events', classId],
    queryFn: () => classes.listEvents(classId),
    enabled: tab === 'calendrier',
  });
  const schedule = useQuery({
    queryKey: ['class-schedule', classId],
    queryFn: () => classes.getWeeklySchedule(classId),
    enabled: tab === 'emploi',
  });

  const c = classQuery.data;
  const classTeachers = (teacherList.data ?? []).filter((t) => t.classes.includes(c?.name ?? ''));
  const matieres = Array.from(new Set(classTeachers.map((t) => t.matiere)));
  const studentsOfClass = roster.data ?? [];
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return studentsOfClass;
    return studentsOfClass.filter((s) => `${s.prenom} ${s.nom}`.toLowerCase().includes(q));
  }, [studentsOfClass, studentSearch]);
  const moyenne = studentsOfClass.length
    ? (studentsOfClass.reduce((a, s) => a + s.moyenne, 0) / studentsOfClass.length).toFixed(1)
    : '—';
  const tauxPaiement = studentsOfClass.length
    ? Math.round(studentsOfClass.reduce((a, s) => a + s.tauxPaiement, 0) / studentsOfClass.length)
    : 0;

  return (
    <div>
      <Link to="/classes" className={styles.back}>
        ← Classes
      </Link>
      <PageHeader
        title={c?.name ?? '…'}
        subtitle={c ? `${c.level}${c.series ? ' ' + c.series : ''} · ${c.effectif}/${c.capacite} élèves` : undefined}
      />

      <StateView loading={classQuery.isLoading} error={classQuery.error}>
        <Card>
          <Segmented<Tab>
            options={[
              { value: 'stats', label: 'Statistiques' },
              { value: 'calendrier', label: 'Calendrier' },
              { value: 'emploi', label: 'Emploi du temps' },
            ]}
            value={tab}
            onChange={setTab}
          />

          <div className={styles.body}>
            {tab === 'stats' ? (
              <>
                <div className={styles.statGrid}>
                  <StatTile label="Moyenne de classe" value={`${moyenne}/20`} />
                  <StatTile label="Taux de paiement" value={`${tauxPaiement}%`} tone={tauxPaiement >= 80 ? 'success' : 'danger'} />
                  <StatTile label="Effectif" value={String(studentsOfClass.length)} />
                </div>

                <div className={styles.panels}>
                  <div className={styles.panel}>
                    <div className={styles.panelTitle}>Professeur principal</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Select value={homeroomDraft} onChange={(e) => setHomeroomDraft(e.target.value)} style={{ flex: 1 }}>
                        <option value="">— Aucun —</option>
                        {(teacherList.data ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nom}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={homeroomDraft === (c?.homeroomTeacherId ?? '')}
                        loading={homeroomMutation.isPending}
                        onClick={() => homeroomMutation.mutate(homeroomDraft)}
                      >
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                  <div className={styles.panel}>
                    <div className={styles.panelTitle}>Professeurs de la classe</div>
                    {classTeachers.length === 0 ? (
                      <p className={styles.muted}>Aucun professeur rattaché à cette classe.</p>
                    ) : (
                      classTeachers.map((t) => (
                        <div key={t.id} className={styles.teacherRow}>
                          <span>{t.nom}</span>
                          <span className={styles.muted}>{t.matiere}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className={styles.panel}>
                    <div className={styles.panelTitle}>Matières enseignées</div>
                    <div className={styles.badgeRow}>
                      {matieres.length === 0 ? (
                        <p className={styles.muted}>Aucune matière renseignée.</p>
                      ) : (
                        matieres.map((m) => <Badge key={m} tone="info">{m}</Badge>)
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.calHead}>
                  <h3 className={styles.sectionTitle}>Élèves de la classe</h3>
                  <Input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Rechercher un élève…"
                    style={{ maxWidth: 220 }}
                  />
                </div>
                <StateView
                  loading={roster.isLoading}
                  error={roster.error}
                  empty={studentsOfClass.length === 0}
                  emptyLabel="Aucun élève dans cette classe pour le moment."
                >
                  <StudentsTable students={filteredStudents} onRowClick={(s) => navigate(`/eleves/${s.id}`)} />
                </StateView>
              </>
            ) : null}

            {tab === 'calendrier' ? (
              <>
                <div className={styles.calHead}>
                  <h3 className={styles.sectionTitle}>Devoirs, examens & échéances</h3>
                  <Button variant="primary" size="sm" onClick={() => setPlanOpen(true)}>
                    + Planifier
                  </Button>
                </div>
                <StateView loading={events.isLoading} error={events.error} empty={(events.data?.length ?? 0) === 0} emptyLabel="Aucune échéance planifiée pour cette classe pour le moment.">
                  <div className={styles.timeline}>
                    {events.data?.map((e) => (
                      <div key={e.id} className={styles.tlItem}>
                        <div className={styles.tlDot} />
                        <div className={styles.tlBody}>
                          <div className={styles.tlHead}>
                            <strong>{e.titre}</strong>
                            <Badge tone={EVENT_TONE[e.type]}>{e.type}</Badge>
                          </div>
                          <div className={styles.muted}>
                            {e.matiere ? `${e.matiere} · ` : ''}
                            {e.date}
                            {e.notes ? ` — ${e.notes}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </StateView>
                <PlanEventSheet classId={classId} open={planOpen} onClose={() => setPlanOpen(false)} />
              </>
            ) : null}

            {tab === 'emploi' ? (
              <StateView loading={schedule.isLoading} error={schedule.error} empty={(schedule.data?.length ?? 0) === 0}>
                <ScheduleGrid slots={schedule.data ?? []} />
              </StateView>
            ) : null}
          </div>
        </Card>
      </StateView>
    </div>
  );
}
