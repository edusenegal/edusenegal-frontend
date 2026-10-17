import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Input, Segmented, Select, StateView, StatTile } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { StudentsTable } from '@/features/students/StudentsTable';
import { MonthWeekPicker, mondayOf } from './MonthWeekPicker';
import { PlanEventSheet } from './PlanEventSheet';
import { ScheduleGrid } from './ScheduleGrid';
import { ScheduleSlotSheet } from './ScheduleSlotSheet';
import styles from './ClassDetailPage.module.css';
import type { ScheduleSlot } from '@/types/domain';

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
  const { classes, teachers, students: studentsPort, paymentConfig, academicResults, subjects, rooms } = useServices();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('stats');
  const [planOpen, setPlanOpen] = useState(false);
  const [homeroomDraft, setHomeroomDraft] = useState('');
  const [roomDraft, setRoomDraft] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const classQuery = useQuery({ queryKey: ['class', classId], queryFn: () => classes.get(classId) });
  const teacherList = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list() });
  const subjectList = useQuery({ queryKey: ['subjects'], queryFn: () => subjects.list() });
  const roomList = useQuery({ queryKey: ['rooms'], queryFn: () => rooms.list() });

  // Le brouillon suit la classe chargée (ou un changement de classe via la
  // navigation) sans écraser une sélection que le directeur est en train de
  // faire avant d'enregistrer.
  useEffect(() => {
    setHomeroomDraft(classQuery.data?.homeroomTeacherId ?? '');
  }, [classQuery.data?.id, classQuery.data?.homeroomTeacherId]);

  useEffect(() => {
    setRoomDraft(classQuery.data?.defaultRoomId ?? '');
  }, [classQuery.data?.id, classQuery.data?.defaultRoomId]);

  const homeroomMutation = useMutation({
    mutationFn: (teacherId: string) => classes.setHomeroomTeacher(classId, teacherId || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });

  /** Salle de classe par défaut (task #229) — simple étiquette pré-remplie, distincte de la salle choisie pour un créneau/examen ponctuel. */
  const roomMutation = useMutation({
    mutationFn: (roomId: string) => classes.setDefaultRoom(classId, roomId || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
  const roster = useQuery({ queryKey: ['students', classId], queryFn: () => studentsPort.list(classId) });
  // Sélecteur de semestre (task #209) — borné par `semesterCount` de la
  // configuration académique effective de la classe (2 par défaut, comme
  // `AcademicResultsPage`).
  const [semesterNumber, setSemesterNumber] = useState(1);
  const academicConfig = useQuery({
    queryKey: ['academic-config', classId],
    queryFn: () => academicResults.getEffectiveConfig(classId),
    enabled: Boolean(classId),
  });
  const classAverage = useQuery({
    queryKey: ['class-average', classId, semesterNumber],
    queryFn: () => academicResults.getClassAverage(classId, semesterNumber),
    enabled: Boolean(classId),
  });
  // Moyenne/absences/taux de paiement PAR ÉLÈVE (task #209) — trois appels
  // bulk distincts (academic-service, attendance-service, payment-service,
  // tâches #207/#208), fusionnés ci-dessous dans les lignes de
  // `StudentsTable` plutôt que de dépendre de `Student.moyenne`/`absences`/
  // `tauxPaiement` (jamais renseignés par `students.api.ts`, voir son
  // commentaire). Les absences ne sont PAS scindées par semestre côté
  // backend (`AbsenceRequest` n'est indexé que par année académique) —
  // simplification connue, affichée telle quelle.
  const studentIds = useMemo(() => (roster.data ?? []).map((s) => s.id), [roster.data]);
  const semesterResults = useQuery({
    queryKey: ['class-semester-results', classId, semesterNumber],
    queryFn: () => academicResults.getClassSemesterResults(classId, semesterNumber),
    enabled: Boolean(classId),
  });
  const paymentRate = useQuery({
    queryKey: ['class-payment-rate', classId, studentIds],
    // `classId` transmis (nouvelle demande direction) : montant dû résolu sur
    // la grille tarifaire exacte de CETTE classe plutôt qu'une moyenne école.
    queryFn: () => paymentConfig.getCollectionRateForStudents(studentIds, classId),
    enabled: studentIds.length > 0,
  });
  const paymentRatesByStudent = useQuery({
    queryKey: ['student-payment-rates', classId, studentIds],
    queryFn: () => paymentConfig.getPaymentRatesForStudents(studentIds, classId),
    enabled: studentIds.length > 0,
  });
  const absenceCounts = useQuery({
    queryKey: ['student-absence-counts', classId, studentIds],
    queryFn: () => studentsPort.getAbsenceCounts(studentIds),
    enabled: studentIds.length > 0,
  });
  const events = useQuery({
    queryKey: ['class-events', classId],
    queryFn: () => classes.listEvents(classId),
    enabled: tab === 'calendrier',
  });
  const cancelEventMutation = useMutation({
    mutationFn: (eventId: string) => classes.cancelEvent(eventId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['class-events', classId] }),
  });
  const schedule = useQuery({
    queryKey: ['class-schedule', classId],
    queryFn: () => classes.getWeeklySchedule(classId),
    enabled: tab === 'emploi',
  });
  // Vue mensuelle + semaine (nouvelle demande direction) — le modèle est
  // hebdomadaire RÉCURRENT côté backend (voir le commentaire de `MonthWeekPicker`),
  // `weekStart` ne fait que déterminer les vraies dates affichées/grisées.
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);

  const c = classQuery.data;
  const classTeachers = (teacherList.data ?? []).filter((t) => t.classes.includes(c?.name ?? ''));
  const subjectNameById = new Map((subjectList.data ?? []).map((s) => [s.id, s.nom]));
  const teacherSubjectNames = (t: { subjectIds: string[] }) =>
    t.subjectIds.map((id) => subjectNameById.get(id) ?? id).join(', ') || '—';
  // Matières ENSEIGNÉES DANS CETTE CLASSE : la liste déroulante des
  // professeurs de la classe n'est pas fiable (un professeur peut être
  // rattaché à la classe sans que sa matière y soit coefficientée, ex.
  // professeur principal sans charge d'enseignement) — la source de vérité
  // est `Subject.coefficients[].classeId` avec `enseignee=true`, exactement
  // ce qu'affiche déjà `SubjectDetailPage`.
  const classSubjects = (subjectList.data ?? []).filter((s) =>
    s.coefficients.some((co) => co.classeId === classId && co.enseignee),
  );
  const matieres = classSubjects.map((s) => s.nom);
  const studentsOfClass = roster.data ?? [];
  const moyenneByStudent = useMemo(
    () => new Map((semesterResults.data ?? []).map((r) => [r.studentId, r.moyenneGenerale])),
    [semesterResults.data],
  );
  // Enrichit chaque élève avec ses propres moyenne/absences/taux de
  // paiement — `Student.moyenne`/`absences`/`tauxPaiement` restent à 0
  // tels que rendus par `students.api.ts`.
  const enrichedStudents = useMemo(
    () =>
      studentsOfClass.map((s) => ({
        ...s,
        moyenne: moyenneByStudent.get(s.id) ?? 0,
        absences: absenceCounts.data?.[s.id] ?? 0,
        tauxPaiement: paymentRatesByStudent.data?.[s.id] ?? 0,
      })),
    [studentsOfClass, moyenneByStudent, absenceCounts.data, paymentRatesByStudent.data],
  );
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return enrichedStudents;
    return enrichedStudents.filter((s) => `${s.prenom} ${s.nom}`.toLowerCase().includes(q));
  }, [enrichedStudents, studentSearch]);
  const moyenne = classAverage.data != null ? classAverage.data.toFixed(1) : '—';
  const tauxPaiement = paymentRate.data ?? 0;
  const tauxPaiementDisponible = paymentRate.data != null;

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
                <div className={styles.calHead}>
                  <h3 className={styles.sectionTitle}>Semestre</h3>
                  <Segmented
                    options={Array.from({ length: academicConfig.data?.semesterCount ?? 2 }, (_, i) => ({
                      value: String(i + 1),
                      label: `Semestre ${i + 1}`,
                    }))}
                    value={String(semesterNumber)}
                    onChange={(v) => setSemesterNumber(Number(v))}
                  />
                </div>
                <div className={styles.statGrid}>
                  <StatTile label="Moyenne de classe" value={`${moyenne}/20`} />
                  <StatTile
                    label="Taux de paiement"
                    value={tauxPaiementDisponible ? `${tauxPaiement}%` : '—'}
                    tone={tauxPaiementDisponible ? (tauxPaiement >= 80 ? 'success' : 'danger') : 'neutral'}
                  />
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
                    <div className={styles.panelTitle}>Salle de classe par défaut</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Select value={roomDraft} onChange={(e) => setRoomDraft(e.target.value)} style={{ flex: 1 }}>
                        <option value="">— Aucune —</option>
                        {(roomList.data ?? []).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nom}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={roomDraft === (c?.defaultRoomId ?? '')}
                        loading={roomMutation.isPending}
                        onClick={() => roomMutation.mutate(roomDraft)}
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
                          <span className={styles.muted}>{teacherSubjectNames(t)}</span>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={cancelEventMutation.isPending && cancelEventMutation.variables === e.id}
                              onClick={() => {
                                if (confirm(`Annuler « ${e.titre} » ? Les élèves, le professeur et la direction seront notifiés.`)) {
                                  cancelEventMutation.mutate(e.id);
                                }
                              }}
                            >
                              ✕ Annuler
                            </Button>
                          </div>
                          <div className={styles.muted}>
                            {e.matiere ? `${e.matiere} · ` : ''}
                            {e.professeur ? `${e.professeur} · ` : ''}
                            {e.date} · {e.heureDebut}–{e.heureFin}
                            {e.salle ? ` · ${e.salle}` : ''}
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
              <>
                <div className={styles.calHead}>
                  <h3 className={styles.sectionTitle}>Emploi du temps</h3>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingSlot(null);
                      setSlotSheetOpen(true);
                    }}
                  >
                    + Ajouter un créneau
                  </Button>
                </div>
                <MonthWeekPicker weekStart={weekStart} onWeekChange={setWeekStart} />
                <StateView loading={schedule.isLoading} error={schedule.error} empty={(schedule.data?.length ?? 0) === 0}>
                  <ScheduleGrid
                    slots={schedule.data ?? []}
                    weekStart={weekStart}
                    onSlotClick={(slot) => {
                      setEditingSlot(slot);
                      setSlotSheetOpen(true);
                    }}
                  />
                </StateView>
                <ScheduleSlotSheet
                  classId={classId}
                  classSubjects={classSubjects}
                  classTeachers={classTeachers}
                  open={slotSheetOpen}
                  editing={editingSlot}
                  onClose={() => setSlotSheetOpen(false)}
                />
              </>
            ) : null}
          </div>
        </Card>
      </StateView>
    </div>
  );
}
