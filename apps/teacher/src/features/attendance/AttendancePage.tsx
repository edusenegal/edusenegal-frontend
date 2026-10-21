import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Input, Select, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { todayISO } from '@/utils/format';
import type { AttendanceSession, AttendanceStatus, AttendanceStudentEntry, TimetableSlot } from '@/types/domain';

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

/** 30 derniers jours (inclus) au format yyyy-mm-dd — fenêtre de l'historique de l'appel (#401). */
function last30Days(): { from: string; to: string } {
  const to = todayISO();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 29);
  return { from: fromDate.toISOString().slice(0, 10), to };
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

  // Historique de l'appel (#401) — une ligne par créneau déjà saisi,
  // "Détails" ouvre une fiche où les élèves absents/en retard peuvent être
  // corrigés sans tout ressaisir.
  const { from: historyFrom, to: historyTo } = last30Days();
  const historyQuery = useQuery({
    queryKey: ['attendance-history', historyFrom, historyTo],
    queryFn: () => attendance.getHistory(historyFrom, historyTo),
  });
  const [detailSession, setDetailSession] = useState<AttendanceSession | null>(null);
  const [detailStatuses, setDetailStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [detailError, setDetailError] = useState<string | null>(null);

  const detailRosterQuery = useQuery({
    queryKey: ['roster', detailSession?.classId ?? ''],
    queryFn: () => myClasses.roster(detailSession?.classId ?? ''),
    enabled: detailSession !== null,
  });

  function openDetail(session: AttendanceSession) {
    setDetailSession(session);
    setDetailError(null);
    setDetailStatuses(Object.fromEntries(session.students.map((s) => [s.studentId, s.statut])));
  }

  const detailMutation = useMutation({
    mutationFn: () => {
      if (!detailSession) return Promise.resolve();
      const eleves: AttendanceStudentEntry[] = detailSession.students.map((s) => ({
        studentId: s.studentId,
        statut: detailStatuses[s.studentId] ?? s.statut,
      }));
      return attendance.mark({
        classId: detailSession.classId,
        subjectId: detailSession.subjectId,
        date: detailSession.date,
        period: detailSession.period,
        eleves,
      });
    },
    onSuccess: () => {
      setDetailSession(null);
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-sheet'] });
    },
    onError: (e) => setDetailError(e instanceof Error ? e.message : "Échec de l'enregistrement."),
  });

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

  const classNameById = useMemo(
    () => new Map((classesQuery.data ?? []).map((c) => [c.id, c.nom])),
    [classesQuery.data],
  );
  const subjectNameById = useMemo(
    () => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.nom])),
    [subjectsQuery.data],
  );

  const historyColumns: Column<AttendanceSession>[] = [
    { key: 'date', header: 'Date', render: (s) => s.date },
    { key: 'classe', header: 'Classe', render: (s) => classNameById.get(s.classId) ?? s.classId },
    { key: 'matiere', header: 'Matière', render: (s) => subjectNameById.get(s.subjectId) ?? s.subjectId },
    { key: 'creneau', header: 'Créneau', render: (s) => s.period },
    {
      key: 'resume',
      header: 'Résumé',
      render: (s) => {
        const absents = s.students.filter((e) => e.statut === 'absent').length;
        const retards = s.students.filter((e) => e.statut === 'retard').length;
        return absents === 0 && retards === 0
          ? `${s.students.length} présents`
          : `${absents} absent${absents > 1 ? 's' : ''}${retards > 0 ? `, ${retards} retard${retards > 1 ? 's' : ''}` : ''}`;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <Button variant="ghost" size="sm" onClick={() => openDetail(s)}>
          Détails
        </Button>
      ),
    },
  ];

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

      <Card padded style={{ marginTop: 16 }}>
        <CardHeader title="Historique de l'appel" />
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
          Les 30 derniers jours. Cliquez sur « Détails » pour revoir ou corriger les absents et les retards.
        </p>
        <StateView
          loading={historyQuery.isLoading}
          error={historyQuery.error}
          onRetry={() => historyQuery.refetch()}
          empty={historyQuery.data?.length === 0}
        >
          <Table<AttendanceSession>
            columns={historyColumns}
            rows={historyQuery.data ?? []}
            rowKey={(s) => s.id}
          />
        </StateView>
      </Card>

      <Sheet
        title="Détails de l'appel"
        open={detailSession !== null}
        onClose={() => setDetailSession(null)}
        width="md"
        footer={
          <Button variant="primary" loading={detailMutation.isPending} onClick={() => detailMutation.mutate()}>
            Enregistrer les modifications
          </Button>
        }
      >
        {detailSession ? (
          <div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
              {classNameById.get(detailSession.classId) ?? detailSession.classId} ·{' '}
              {subjectNameById.get(detailSession.subjectId) ?? detailSession.subjectId} · {detailSession.date} ·{' '}
              {detailSession.period}
            </p>
            {detailError ? (
              <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: '0 0 8px' }}>{detailError}</p>
            ) : null}
            <StateView
              loading={detailRosterQuery.isLoading}
              error={detailRosterQuery.error}
              empty={detailRosterQuery.data?.length === 0}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(detailRosterQuery.data ?? []).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderTop: '1px solid var(--color-border)',
                    }}
                  >
                    <span>
                      {s.prenom} {s.nom}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {STATUSES.map((st) => (
                        <Button
                          key={st}
                          variant={detailStatuses[s.id] === st ? 'primary' : 'ghost'}
                          size="sm"
                          onClick={() => setDetailStatuses((prev) => ({ ...prev, [s.id]: st }))}
                        >
                          {STATUS_LABEL[st]}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </StateView>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
