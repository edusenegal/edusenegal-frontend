import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Card,
  CardHeader,
  Meter,
  Segmented,
  StateView,
  Table,
  type Column,
  type SegmentedOption,
} from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { todayISO } from '@/utils/format';
import type {
  AbsentStudentEntry,
  AttendanceSession,
  AttendanceTrendGranularity,
  AttendanceTrendPoint,
} from '@/types/domain';
import styles from './AttendanceClassPage.module.css';

const STATUS_TONE = { ABSENT: 'danger', LATE: 'warning', PRESENT: 'success', JUSTIFIED: 'neutral' } as const;
const STATUS_LABEL = { ABSENT: 'Absent', LATE: 'Retard', PRESENT: 'Présent', JUSTIFIED: 'Justifié' } as const;

const GRANULARITY_OPTIONS: SegmentedOption<AttendanceTrendGranularity>[] = [
  { value: 'DAY', label: 'Jour' },
  { value: 'WEEK', label: 'Semaine' },
  { value: 'MONTH', label: 'Mois' },
];

/** Même plage par défaut que `AttendanceOverviewPage` (#426) — voir son commentaire. */
function trendRangeFor(granularity: AttendanceTrendGranularity): { from: string; to: string } {
  const to = todayISO();
  const days = granularity === 'DAY' ? 13 : granularity === 'WEEK' ? 55 : 179;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

/**
 * Détail d'une classe, depuis la vue "Présence & absences" (item #400) :
 * élèves absents/en retard, et — item #426, demande censeur/surveillant
 * général — la même vue "par créneau" en temps réel + évolution du taux de
 * présence/absence que `AttendanceOverviewPage`, restreinte à cette classe.
 */
export default function AttendanceClassPage() {
  const { classId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { studentAttendance } = useServices();

  const today = todayISO();
  const from = searchParams.get('from') ?? today;
  const to = searchParams.get('to') ?? today;

  const absentQuery = useQuery({
    queryKey: ['attendance-class-absences', classId, from, to],
    queryFn: () => studentAttendance.getAbsentStudents(classId, from, to),
  });

  const sessionsQuery = useQuery({
    queryKey: ['attendance-class-sessions', classId, today],
    queryFn: () => studentAttendance.getClassSessions(classId, today, today),
  });

  const [trendGranularity, setTrendGranularity] = useState<AttendanceTrendGranularity>('DAY');
  const trendRange = useMemo(() => trendRangeFor(trendGranularity), [trendGranularity]);
  const trendQuery = useQuery({
    queryKey: ['attendance-class-trend', classId, trendGranularity, trendRange.from, trendRange.to],
    queryFn: () => studentAttendance.getClassTrend(classId, trendRange.from, trendRange.to, trendGranularity),
  });

  const columns: Column<AbsentStudentEntry>[] = [
    { key: 'eleve', header: 'Élève', render: (s) => s.studentNom },
    {
      key: 'statut',
      header: 'Statut',
      render: (s) => <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>,
    },
    { key: 'note', header: 'Note', render: (s) => s.note ?? '—' },
  ];

  const sessionColumns: Column<AttendanceSession>[] = [
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
      <Link to="/presence" className={styles.back}>
        ← Présence & absences
      </Link>
      <PageHeader title="Élèves absents / en retard" subtitle={`Du ${from} au ${to}.`} />

      <StateView
        loading={absentQuery.isLoading}
        error={absentQuery.error}
        onRetry={() => absentQuery.refetch()}
        empty={absentQuery.data?.length === 0}
      >
        <Table columns={columns} rows={absentQuery.data ?? []} rowKey={(s) => s.studentId} />
      </StateView>

      <Card padded style={{ marginTop: 'var(--space-lg)' }}>
        <CardHeader title="Par créneau — aujourd'hui" />
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 12 }}>
          Taux de présence/absence en temps réel, créneau par créneau, pour cette classe.
        </p>
        <StateView
          loading={sessionsQuery.isLoading}
          error={sessionsQuery.error}
          onRetry={() => sessionsQuery.refetch()}
          empty={sessionsQuery.data?.length === 0}
          emptyLabel="Aucun créneau de cours aujourd’hui pour cette classe."
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
