import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Meter,
  Segmented,
  StateView,
  StatTile,
  Table,
  type Column,
  type SegmentedOption,
} from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { todayISO } from '@/utils/format';
import type { AttendanceSession, AttendanceTrendGranularity, AttendanceTrendPoint, ClassAttendanceRate } from '@/types/domain';
import styles from './AttendanceOverviewPage.module.css';

type Period = 'jour' | '7j' | '30j';

const PERIOD_OPTIONS: SegmentedOption<Period>[] = [
  { value: 'jour', label: "Aujourd'hui" },
  { value: '7j', label: '7 derniers jours' },
  { value: '30j', label: '30 derniers jours' },
];

function rangeFor(period: Period): { from: string; to: string } {
  const to = todayISO();
  const days = period === 'jour' ? 0 : period === '7j' ? 6 : 29;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

/**
 * Fenêtre PRÉCÉDENTE de même longueur, se terminant la veille de `from` —
 * sert à calculer le +/- du jour (ou de la période) par rapport au précédent
 * (demande explicite : « taux de plus ou moins par rapport à la journée
 * précédente »). Pour « Aujourd'hui », c'est hier ; pour 7j/30j, la période
 * de même durée juste avant.
 */
function prevRangeFor(period: Period, from: string): { from: string; to: string } {
  const days = period === 'jour' ? 0 : period === '7j' ? 6 : 29;
  const prevTo = new Date(`${from}T00:00:00`);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - days);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

const GRANULARITY_OPTIONS: SegmentedOption<AttendanceTrendGranularity>[] = [
  { value: 'DAY', label: 'Jour' },
  { value: 'WEEK', label: 'Semaine' },
  { value: 'MONTH', label: 'Mois' },
];

/**
 * Plage par défaut de l'évolution (#426), indépendante du sélecteur de
 * période ci-dessus (qui ne contrôle que les tuiles et le tableau par
 * classe) — assez de points pour une courbe lisible à chaque granularité.
 */
function trendRangeFor(granularity: AttendanceTrendGranularity): { from: string; to: string } {
  const to = todayISO();
  const days = granularity === 'DAY' ? 13 : granularity === 'WEEK' ? 55 : 179;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

/**
 * Tableau de bord présence/absence/retard — item #400.
 *
 * "Taux de présence/absence/retard de l'école" (tuile cliquée depuis le
 * tableau de bord directeur) → liste des classes avec leur propre taux →
 * clic sur une classe → liste des élèves absents (`AttendanceClassPage`).
 */
export default function AttendanceOverviewPage() {
  const navigate = useNavigate();
  const { studentAttendance } = useServices();
  const [period, setPeriod] = useState<Period>('jour');
  const { from, to } = useMemo(() => rangeFor(period), [period]);

  const schoolStats = useQuery({
    queryKey: ['attendance-school-stats', from, to],
    queryFn: () => studentAttendance.getSchoolStats(from, to),
    placeholderData: keepPreviousData,
    // Rafraîchi régulièrement pour refléter chaque appel saisi en cours de
    // journée (demande : « mis à jour après chaque fin de créneau »).
    refetchInterval: period === 'jour' ? 60_000 : false,
    refetchOnWindowFocus: true,
  });
  const prevRange = useMemo(() => prevRangeFor(period, from), [period, from]);
  const prevStats = useQuery({
    queryKey: ['attendance-school-stats-prev', prevRange.from, prevRange.to],
    queryFn: () => studentAttendance.getSchoolStats(prevRange.from, prevRange.to),
    placeholderData: keepPreviousData,
  });
  const classesStats = useQuery({
    queryKey: ['attendance-classes-stats', from, to],
    queryFn: () => studentAttendance.getClassesStats(from, to),
    placeholderData: keepPreviousData,
  });

  // Vue "par créneau" en temps réel (item #426, demande censeur/surveillant
  // général) — toujours aujourd'hui, indépendamment du sélecteur de période
  // ci-dessus (voir le doc-comment de `StudentAttendancePort.getSchoolSessions`).
  const today = todayISO();
  const sessionsQuery = useQuery({
    queryKey: ['attendance-school-sessions', today],
    queryFn: () => studentAttendance.getSchoolSessions(today, today),
    placeholderData: keepPreviousData,
    // « Par créneau — aujourd'hui » se veut temps réel : un appel que le prof
    // vient d'enregistrer doit apparaître sans rechargement manuel. Seules les
    // tuiles de stats se rafraîchissaient ; la liste des séances, non.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Évolution du taux de présence/absence (#426) — granularité jour/semaine/mois.
  const [trendGranularity, setTrendGranularity] = useState<AttendanceTrendGranularity>('DAY');
  const trendRange = useMemo(() => trendRangeFor(trendGranularity), [trendGranularity]);
  const trendQuery = useQuery({
    queryKey: ['attendance-school-trend', trendGranularity, trendRange.from, trendRange.to],
    queryFn: () => studentAttendance.getSchoolTrend(trendRange.from, trendRange.to, trendGranularity),
    placeholderData: keepPreviousData,
  });

  const s = schoolStats.data;
  const prev = prevStats.data;
  const prevLabel = period === 'jour' ? 'hier' : 'période préc.';
  const signed = (d: number) => `${d > 0 ? '+' : d < 0 ? '' : '±'}${d}`;
  const countDelta = (cur: number, p?: number): string | undefined =>
    prev && p !== undefined ? `${signed(cur - p)} vs ${prevLabel}` : undefined;
  // CORRECTION (page blanche sur « 7/30 derniers jours ») : `s!` affirmait à
  // tort que `schoolStats.data` était toujours présent. Au changement de
  // période, la requête `prevStats` peut répondre AVANT `schoolStats` — `prev`
  // est alors défini pendant que `s` est encore `undefined`, et `s!.attendanceRate`
  // lançait un TypeError qui démontait tout l'écran. On garde donc sur `s`.
  const rateDelta =
    s && prev != null
      ? `${(s.attendanceRate - prev.attendanceRate) >= 0 ? '+' : ''}${(s.attendanceRate - prev.attendanceRate).toFixed(1)} pts vs ${prevLabel}`
      : undefined;
  const rateTrendTone: 'success' | 'danger' | 'neutral' =
    s && prev ? (s.attendanceRate >= prev.attendanceRate ? 'success' : 'danger') : 'neutral';

  const columns: Column<ClassAttendanceRate>[] = [
    { key: 'classe', header: 'Classe', render: (c) => c.className },
    { key: 'effectif', header: 'Effectif', render: (c) => String(c.totalStudents), align: 'right' },
    { key: 'present', header: 'Présents', render: (c) => String(c.present), align: 'right' },
    { key: 'absent', header: 'Absents', render: (c) => String(c.absent), align: 'right' },
    { key: 'retard', header: 'Retards', render: (c) => String(c.late), align: 'right' },
    { key: 'taux', header: 'Taux de présence', render: (c) => `${c.attendanceRate}%`, align: 'right' },
  ];

  const sessionColumns: Column<AttendanceSession>[] = [
    { key: 'classe', header: 'Classe', render: (s) => s.className },
    { key: 'creneau', header: 'Créneau', render: (s) => `${s.dayOfWeek} ${s.period}` },
    { key: 'matiere', header: 'Matière', render: (s) => s.matiere ?? '—' },
    { key: 'professeur', header: 'Professeur', render: (s) => s.professeur ?? '—' },
    { key: 'present', header: 'Présents', render: (s) => String(s.present), align: 'right' },
    { key: 'absent', header: 'Absents', render: (s) => String(s.absent), align: 'right' },
    { key: 'retard', header: 'Retards', render: (s) => String(s.late), align: 'right' },
    {
      key: 'taux',
      header: 'Taux de présence',
      render: (s) => (
        <Badge tone={s.attendanceRate >= 90 ? 'success' : s.attendanceRate >= 75 ? 'warning' : 'danger'}>
          {s.attendanceRate.toFixed(0)}%
        </Badge>
      ),
      align: 'right',
    },
  ];

  const trendColumns: Column<AttendanceTrendPoint>[] = [
    { key: 'periode', header: 'Période', render: (p) => p.periodLabel },
    { key: 'present', header: 'Présents', render: (p) => String(p.present), align: 'right' },
    { key: 'absent', header: 'Absents', render: (p) => String(p.absent), align: 'right' },
    {
      key: 'taux',
      header: 'Taux de présence',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
          <Meter value={p.attendanceRate} tone={p.attendanceRate >= 90 ? 'success' : p.attendanceRate >= 75 ? 'warning' : 'danger'} />
          <span style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{p.attendanceRate.toFixed(0)}%</span>
        </div>
      ),
    },
    {
      key: 'tauxAbsence',
      header: "Taux d'absence",
      render: (p) => `${(100 - p.attendanceRate).toFixed(0)}%`,
      align: 'right',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Présence & absences"
        subtitle="Taux de présence, d'absence et de retard de l'école — par classe."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => navigate('/presence/absences-du-jour')}>
              Absents du jour par classe
            </Button>
            <Button variant="secondary" onClick={() => navigate('/presence/demandes')}>
              Demandes à traiter
            </Button>
          </div>
        }
      />

      <div className={styles.toolbar}>
        <Segmented<Period> options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>

      <StateView loading={schoolStats.isLoading} error={schoolStats.error} onRetry={() => schoolStats.refetch()}>
        {s ? (
          <div className={styles.grid}>
            <StatTile label="Présents" value={String(s.present)} tone="success" delta={countDelta(s.present, prev?.present)} />
            <StatTile
              label="Absents"
              value={String(s.absent)}
              tone={s.absent > 0 ? 'danger' : 'success'}
              delta={countDelta(s.absent, prev?.absent)}
            />
            <StatTile
              label="Retards"
              value={String(s.late)}
              tone={s.late > 0 ? 'warning' : 'success'}
              delta={countDelta(s.late, prev?.late)}
            />
            <StatTile label="Taux de présence" value={`${s.attendanceRate}%`} tone={rateTrendTone} delta={rateDelta} />
          </div>
        ) : null}
      </StateView>

      <StateView
        loading={classesStats.isLoading}
        error={classesStats.error}
        onRetry={() => classesStats.refetch()}
        empty={classesStats.data?.length === 0}
      >
        <Table
          columns={columns}
          rows={classesStats.data ?? []}
          rowKey={(c) => c.classId}
          onRowClick={(c) => navigate(`/presence/classes/${c.classId}?from=${from}&to=${to}`)}
        />
      </StateView>

      {/*
        Vue "par créneau" en temps réel + évolution du taux de présence/
        absence (item #426, demande censeur/surveillant général) — un clic
        sur une classe ci-dessus donne la même vue restreinte à cette classe
        (`AttendanceClassPage`).
      */}
      <Card padded style={{ marginTop: 'var(--space-lg)' }}>
        <CardHeader title="Par créneau — aujourd'hui" />
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 12 }}>
          Taux de présence/absence en temps réel, créneau par créneau, pour toutes les classes de l’école.
        </p>
        <StateView
          loading={sessionsQuery.isLoading}
          error={sessionsQuery.error}
          onRetry={() => sessionsQuery.refetch()}
          empty={sessionsQuery.data?.length === 0}
          emptyLabel="Aucun créneau de cours aujourd’hui."
        >
          <Table
            columns={sessionColumns}
            rows={sessionsQuery.data ?? []}
            rowKey={(s) => s.id}
            onRowClick={(s) => navigate(`/presence/seances/${s.id}`)}
          />
        </StateView>
      </Card>

      <Card padded style={{ marginTop: 'var(--space-lg)' }}>
        <CardHeader
          title="Évolution du taux de présence et d'absence"
          action={<Segmented<AttendanceTrendGranularity> options={GRANULARITY_OPTIONS} value={trendGranularity} onChange={setTrendGranularity} />}
        />
        <StateView
          loading={trendQuery.isLoading}
          error={trendQuery.error}
          onRetry={() => trendQuery.refetch()}
          empty={trendQuery.data?.length === 0}
        >
          <Table columns={trendColumns} rows={trendQuery.data ?? []} rowKey={(p) => p.periodStart} />
        </StateView>
      </Card>
    </div>
  );
}
