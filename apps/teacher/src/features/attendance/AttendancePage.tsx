import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Input, Segmented, Select, Sheet, StateView, Table, type Column, type SegmentedOption } from '@/components/ui';
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

/** Fenêtre d'affichage de l'historique de l'appel — jour / semaine / mois. */
type HistoryPeriod = 'jour' | 'semaine' | 'mois';
const HISTORY_PERIOD_OPTIONS: SegmentedOption<HistoryPeriod>[] = [
  { value: 'jour', label: "Aujourd'hui" },
  { value: 'semaine', label: 'Cette semaine' },
  { value: 'mois', label: 'Ce mois' },
];

/** `date` (yyyy-mm-dd) → jour de semaine FR attendu par `TimetableSlot.jour` — même conversion que `isSlotNow`. */
function weekdayOfDate(dateISO: string): TimetableSlot['jour'] | null {
  if (!dateISO) return null;
  return WEEKDAY_FROM_JS_DAY[new Date(`${dateISO}T00:00:00`).getDay()] ?? null;
}

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
  const [period, setPeriod] = useState('');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Fenêtre d'affichage de l'historique (demande : « durant la journée, par
  // semaine ou le mois ») — filtrée côté client sur les 30 jours déjà chargés,
  // sans appel réseau supplémentaire.
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('jour');

  // CORRECTION (signalé) "le créneau reste toujours 8:00-10:00" : en dehors
  // du raccourci « Appel pour… » (qui pré-remplit period depuis le créneau
  // en cours), rien ne mettait jamais à jour period — il gardait la valeur
  // par défaut, fausse dès que ce n'était pas réellement 8h-10h. On la
  // déduit maintenant de l'emploi du temps (classe + matière + jour de la
  // date choisie) dès que ces trois champs désignent un créneau connu ; sans
  // correspondance (rattrapage, créneau hors emploi du temps…), le champ
  // reste vide plutôt que de proposer une heure inventée, et le professeur
  // le saisit lui-même.
  useEffect(() => {
    if (!classId || !subjectId || !date) return;
    const weekday = weekdayOfDate(date);
    const slot = (timetableQuery.data ?? []).find(
      (s) => s.classId === classId && s.subjectId === subjectId && s.jour === weekday,
    );
    if (slot) {
      setPeriod(`${slot.heureDebut}-${slot.heureFin}`);
    }
  }, [classId, subjectId, date, timetableQuery.data]);

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

  // Liste de la classe triée par ordre alphabétique (nom puis prénom) —
  // demande explicite : « la liste des élèves par ordre alphabétique » pour
  // faire l'appel.
  const sortedRoster = useMemo(
    () =>
      [...(rosterQuery.data ?? [])].sort((a, b) => {
        const byNom = (a.nom ?? '').localeCompare(b.nom ?? '', 'fr', { sensitivity: 'base' });
        return byNom !== 0 ? byNom : (a.prenom ?? '').localeCompare(b.prenom ?? '', 'fr', { sensitivity: 'base' });
      }),
    [rosterQuery.data],
  );

  const effectiveStatuses = useMemo(() => {
    const merged: Record<string, AttendanceStatus> = {};
    for (const s of sortedRoster) {
      merged[s.id] = statuses[s.id] ?? 'present';
    }
    return merged;
  }, [sortedRoster, statuses]);

  const markMutation = useMutation({
    mutationFn: () => {
      const eleves: AttendanceStudentEntry[] = sortedRoster.map((s) => ({
        studentId: s.id,
        statut: effectiveStatuses[s.id] ?? 'present',
      }));
      return attendance.mark({ classId, subjectId, date, period, eleves });
    },
    onSuccess: () => {
      setSaved(true);
      setError(null);
      // L'historique est la source de vérité de « appel déjà enregistré »
      // (voir `currentSession`) : on l'invalide pour que le nouveau créneau
      // apparaisse aussitôt en haut de la liste et que la saisie bascule sur
      // le récapitulatif sans recharger la page.
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
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
  // CORRECTION (signalé) "la matière c'est l'id de la matière qui est là" :
  // cette carte ne venait que de subjects.listMine() (les matières du profil
  // du professeur), alors que le raccourci "Appel pour…" pré-remplit subjectId
  // depuis l'emploi du temps (timetable.mine()) -- deux sources distinctes,
  // pas forcément alignées. L'emploi du temps résout déjà lui-même chaque
  // `subjectId` en `matiere` (voir TimetableSlot) : on complète la carte avec
  // ces paires-là aussi, ce qui couvre l'historique quel que soit le chemin
  // utilisé pour faire l'appel.
  const subjectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjectsQuery.data ?? []) {
      map.set(s.id, s.nom);
    }
    for (const slot of timetableQuery.data ?? []) {
      if (slot.subjectId && slot.matiere && !map.has(slot.subjectId)) {
        map.set(slot.subjectId, slot.matiere);
      }
    }
    return map;
  }, [subjectsQuery.data, timetableQuery.data]);

  // Appel déjà enregistré pour le créneau sélectionné (sert à masquer la
  // liste après enregistrement et à ouvrir son détail pour correction).
  const currentSession = useMemo(
    () =>
      (historyQuery.data ?? []).find(
        (h) => h.classId === classId && h.subjectId === subjectId && h.date === date && h.period === period,
      ) ?? null,
    [historyQuery.data, classId, subjectId, date, period],
  );

  // Récapitulatif de l'appel déjà enregistré pour CE créneau — calculé depuis
  // l'historique (la vérité par créneau), et non plus depuis la feuille
  // agrégée par date qui renvoyait 0/0 et masquait à tort la liste alors
  // qu'aucun appel n'avait encore été fait.
  const recordedTotal = currentSession?.students.length ?? 0;
  const recordedPresent = currentSession?.students.filter((e) => e.statut === 'present').length ?? 0;
  const recordedRate = recordedTotal ? Math.round((recordedPresent / recordedTotal) * 100) : 0;

  const historyFromDisplayISO = useMemo(() => {
    const d = new Date();
    const days = historyPeriod === 'jour' ? 0 : historyPeriod === 'semaine' ? 6 : 29;
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }, [historyPeriod]);
  const displayedHistory = useMemo(
    () => (historyQuery.data ?? []).filter((h) => h.date >= historyFromDisplayISO),
    [historyQuery.data, historyFromDisplayISO],
  );

  const historyColumns: Column<AttendanceSession>[] = [
    { key: 'date', header: 'Date', render: (s) => s.date },
    { key: 'classe', header: 'Classe', render: (s) => classNameById.get(s.classId) ?? s.classId },
    { key: 'matiere', header: 'Matière', render: (s) => s.subjectName ?? subjectNameById.get(s.subjectId) ?? s.subjectId },
    { key: 'creneau', header: 'Créneau', render: (s) => s.period },
    {
      key: 'etat',
      header: 'État',
      render: (s) => (s.locked ? <Badge tone="neutral">🔒 Verrouillé</Badge> : <Badge tone="success">Modifiable</Badge>),
    },
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
      key: 'taux',
      header: 'Taux présence',
      align: 'right',
      render: (s) => {
        const total = s.students.length;
        const present = s.students.filter((e) => e.statut === 'present').length;
        return total ? `${Math.round((present / total) * 100)}%` : '—';
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
          {currentSession ? (
            // Appel déjà enregistré pour CE créneau : la liste est masquée
            // (demande explicite), la correction se fait via le détail de
            // l'appel — tant que le surveillant général ne l'a pas verrouillé.
            <>
              <CardHeader title="Élèves" />
              <p style={{ fontSize: 13, margin: '0 0 8px' }}>
                <Badge tone="info">Appel enregistré</Badge> {recordedPresent}/{recordedTotal} présents (
                {recordedRate}%).
              </p>
              {currentSession?.locked ? (
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
                  🔒 Appel verrouillé par la direction — il ne peut plus être modifié.
                </p>
              ) : (
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
                  La liste est masquée après enregistrement. Pour corriger l'état d'un élève, ouvrez le détail de cet appel.
                </p>
              )}
              {currentSession ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentSession.locked}
                  onClick={() => openDetail(currentSession)}
                >
                  Modifier cet appel
                </Button>
              ) : null}
            </>
          ) : (
            <>
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
              <StateView loading={rosterQuery.isLoading} error={rosterQuery.error} empty={sortedRoster.length === 0}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sortedRoster.map((s) => (
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
            </>
          )}
        </Card>
      ) : null}

      <Card padded style={{ marginTop: 16 }}>
        <CardHeader
          title="Historique de l'appel"
          action={<Segmented<HistoryPeriod> options={HISTORY_PERIOD_OPTIONS} value={historyPeriod} onChange={setHistoryPeriod} />}
        />
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
          Tous vos appels de la période. Cliquez sur « Détails » pour revoir ou corriger les absents et les retards tant que la direction n'a pas verrouillé l'appel.
        </p>
        <StateView
          loading={historyQuery.isLoading}
          error={historyQuery.error}
          onRetry={() => historyQuery.refetch()}
          empty={displayedHistory.length === 0}
        >
          <Table<AttendanceSession>
            columns={historyColumns}
            rows={displayedHistory}
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
          <Button
            variant="primary"
            loading={detailMutation.isPending}
            disabled={detailSession?.locked}
            onClick={() => detailMutation.mutate()}
          >
            Enregistrer les modifications
          </Button>
        }
      >
        {detailSession ? (
          <div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
              {classNameById.get(detailSession.classId) ?? detailSession.classId} ·{' '}
              {detailSession.subjectName ?? subjectNameById.get(detailSession.subjectId) ?? detailSession.subjectId} ·{' '}
              {detailSession.date} ·{' '}
              {detailSession.period}
            </p>
            {detailSession.locked ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                🔒 Appel verrouillé par la direction — vous ne pouvez plus modifier les états.
              </p>
            ) : null}
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
                          disabled={detailSession.locked}
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
