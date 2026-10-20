import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Input, Select, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { todayISO } from '@/utils/format';
import type { AttendanceStatus, AttendanceStudentEntry, TimetableSlot } from '@/types/domain';

/** `Date#getDay()` (0 = dimanche) → libellé du jour -- même convention que `SchedulePage`. */
const WEEKDAY_FROM_JS_DAY: Record<number, TimetableSlot['jour'] | null> = {
  0: null, // dimanche — jamais de cours dans ce modèle
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

/** Le créneau est-il celui en cours MAINTENANT (même jour, heure comprise dans [début, fin[) ? */
function isSlotNow(slot: TimetableSlot, now: Date): boolean {
  if (WEEKDAY_FROM_JS_DAY[now.getDay()] !== slot.jour) return false;
  const [startH, startM] = slot.heureDebut.split(':').map(Number);
  const [endH, endM] = slot.heureFin.split(':').map(Number);
  if (startH === undefined || startM === undefined || endH === undefined || endM === undefined) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return minutesNow >= startH * 60 + startM && minutesNow < endH * 60 + endM;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Présent',
  absent: 'Absent',
  retard: 'Retard',
  justifie: 'Justifié',
};
const STATUSES: AttendanceStatus[] = ['present', 'absent', 'retard', 'justifie'];

function isFutureSlot(date: string, period: string): boolean {
  const todayStr = todayISO();
  if (date > todayStr) return true;
  if (date < todayStr) return false;
  const startTime = period.split('-')[0]?.trim();
  if (!startTime) return false;
  const parts = startTime.split(':').map(Number);
  const h = parts[0];
  const m = parts[1];
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return false;
  const now = new Date();
  const slotStart = new Date();
  slotStart.setHours(h, m, 0, 0);
  return slotStart > now;
}

export default function AttendancePage() {
  const { myClasses, subjects, attendance, timetable } = useServices();
  const queryClient = useQueryClient();

  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'mine'], queryFn: () => subjects.listMine() });
  // CORRECTION (demande explicite) — « Appel rapide » : le professeur qui a
  // cours MAINTENANT (ex. Habib Gueye, 15h-17h, Seconde SA, à 15h56) n'a
  // sinon qu'un sélecteur de classe/matière/créneau libre à remplir à la
  // main, créneau qu'il doit déjà connaître. L'emploi du temps (déjà
  // consommé par "Mon emploi du temps") donne tout ce qu'il faut pour le
  // pré-remplir.
  const timetableQuery = useQuery({ queryKey: ['timetable', 'mine'], queryFn: () => timetable.mine() });

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [period, setPeriod] = useState('08:00-10:00');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // "Cours" uniquement : une permanence (pas de matière) n'a rien à appeler.
  const currentSlot = useMemo(() => {
    const now = new Date();
    return (timetableQuery.data ?? []).find((s) => s.subjectId && isSlotNow(s, now)) ?? null;
  }, [timetableQuery.data]);

  function startAttendanceForCurrentSlot() {
    if (!currentSlot?.subjectId) return;
    setClassId(currentSlot.classId);
    setSubjectId(currentSlot.subjectId);
    setDate(todayISO());
    setPeriod(`${currentSlot.heureDebut}-${currentSlot.heureFin}`);
    setStatuses({});
    setSaved(false);
    setError(null);
  }

  const rosterQuery = useQuery({
    queryKey: ['roster', classId],
    queryFn: () => myClasses.roster(classId),
    enabled: classId !== '',
  });

  const sheetQuery = useQuery({
    queryKey: ['attendance-sheet', classId, subjectId, date],
    queryFn: () => attendance.getSheet(classId, subjectId, date),
    enabled: classId !== '' && subjectId !== '' && date !== '',
  });

  const effectiveStatuses = useMemo(() => {
    const merged: Record<string, AttendanceStatus> = {};
    for (const s of rosterQuery.data ?? []) {
      merged[s.id] =
        statuses[s.id] ?? sheetQuery.data?.students.find((e) => e.studentId === s.id)?.statut ?? 'present';
    }
    return merged;
  }, [rosterQuery.data, sheetQuery.data, statuses]);

  const markMutation = useMutation({
    mutationFn: () => {
      const eleves: AttendanceStudentEntry[] = (rosterQuery.data ?? []).map((s) => ({
        studentId: s.id,
        statut: effectiveStatuses[s.id] ?? 'present',
      }));
      return attendance.mark({ classId, subjectId, date, period, eleves });
    },
    onSuccess: () => {
      setSaved(true);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['attendance-sheet', classId, subjectId, date] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Échec de l’enregistrement.'),
  });

  function onSubmit() {
    if (!classId || !subjectId || !date || !period) {
      setError('Classe, matière, date et créneau sont obligatoires.');
      return;
    }
    if (isFutureSlot(date, period)) {
      setError("Vous ne pouvez pas faire l'appel pour une date ou un horaire à venir.");
      return;
    }
    setSaved(false);
    markMutation.mutate();
  }

  return (
    <div>
      <PageHeader title="Appel" subtitle="Saisissez la présence des élèves pour un créneau." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader
          title="Créneau"
          action={
            currentSlot ? (
              <Button variant="primary" size="sm" onClick={startAttendanceForCurrentSlot}>
                Appel pour {currentSlot.classe} ({currentSlot.heureDebut}-{currentSlot.heureFin})
              </Button>
            ) : undefined
          }
        />
        {!currentSlot && !timetableQuery.isLoading ? (
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
            Aucun cours à l’emploi du temps en ce moment — choisissez la classe et le créneau manuellement.
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Classe" required>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 200 }}>
              <option value="">Choisir…</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Matière" required>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: 200 }}>
              <option value="">Choisir…</option>
              {(subjectsQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" required>
            <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Créneau horaire" required>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="08:00-10:00" style={{ width: 140 }} />
          </Field>
        </div>
      </Card>

      {classId && subjectId ? (
        <Card>
          <CardHeader
            title="Élèves"
            action={
              <Button variant="primary" size="sm" loading={markMutation.isPending} onClick={onSubmit}>
                Enregistrer l’appel
              </Button>
            }
          />
          {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: '0 0 8px' }}>{error}</p> : null}
          {saved ? <p style={{ color: 'var(--color-success)', fontSize: 13, margin: '0 0 8px' }}>Appel enregistré.</p> : null}
          <StateView loading={rosterQuery.isLoading} error={rosterQuery.error} empty={rosterQuery.data?.length === 0}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(rosterQuery.data ?? []).map((s) => (
                <div
                  key={s.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--color-border)' }}
                >
                  <span>
                    {s.prenom} {s.nom}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {STATUSES.map((st) => (
                      <Button
                        key={st}
                        variant={effectiveStatuses[s.id] === st ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setStatuses((prev) => ({ ...prev, [s.id]: st }))}
                      >
                        {STATUS_LABEL[st]}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </StateView>
          {sheetQuery.data ? (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 10 }}>
              <Badge tone="info">Déjà saisi</Badge> {sheetQuery.data.present}/{sheetQuery.data.totalStudents} présents (
              {sheetQuery.data.attendanceRate}%).
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
