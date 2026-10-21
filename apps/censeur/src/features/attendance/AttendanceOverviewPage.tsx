import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Segmented, StateView, StatTile, Table, type Column, type SegmentedOption } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { todayISO } from '@/utils/format';
import type { ClassAttendanceRate } from '@/types/domain';
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
  });
  const classesStats = useQuery({
    queryKey: ['attendance-classes-stats', from, to],
    queryFn: () => studentAttendance.getClassesStats(from, to),
  });

  const s = schoolStats.data;

  const columns: Column<ClassAttendanceRate>[] = [
    { key: 'classe', header: 'Classe', render: (c) => c.className },
    { key: 'effectif', header: 'Effectif', render: (c) => String(c.totalStudents), align: 'right' },
    { key: 'present', header: 'Présents', render: (c) => String(c.present), align: 'right' },
    { key: 'absent', header: 'Absents', render: (c) => String(c.absent), align: 'right' },
    { key: 'retard', header: 'Retards', render: (c) => String(c.late), align: 'right' },
    { key: 'taux', header: 'Taux de présence', render: (c) => `${c.attendanceRate}%`, align: 'right' },
  ];

  return (
    <div>
      <PageHeader
        title="Présence & absences"
        subtitle="Taux de présence, d'absence et de retard de l'école — par classe."
        action={
          <Button variant="secondary" onClick={() => navigate('/presence/demandes')}>
            Demandes à traiter
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <Segmented<Period> options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>

      <StateView loading={schoolStats.isLoading} error={schoolStats.error} onRetry={() => schoolStats.refetch()}>
        {s ? (
          <div className={styles.grid}>
            <StatTile label="Présents" value={String(s.present)} tone="success" />
            <StatTile label="Absents" value={String(s.absent)} tone={s.absent > 0 ? 'danger' : 'success'} />
            <StatTile label="Retards" value={String(s.late)} tone={s.late > 0 ? 'warning' : 'success'} />
            <StatTile label="Taux de présence" value={`${s.attendanceRate}%`} />
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
    </div>
  );
}
