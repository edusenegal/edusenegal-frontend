import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { todayISO } from '@/utils/format';
import type { AbsentStudentEntry } from '@/types/domain';
import styles from './AttendanceClassPage.module.css';

const STATUS_TONE = { ABSENT: 'danger', LATE: 'warning', PRESENT: 'success', JUSTIFIED: 'neutral' } as const;
const STATUS_LABEL = { ABSENT: 'Absent', LATE: 'Retard', PRESENT: 'Présent', JUSTIFIED: 'Justifié' } as const;

/** Liste des élèves absents/en retard d'une classe, sur la période du tableau de bord (item #400). */
export default function AttendanceClassPage() {
  const { classId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { studentAttendance } = useServices();

  const today = todayISO();
  const from = searchParams.get('from') ?? today;
  const to = searchParams.get('to') ?? today;

  const absentQuery = useQuery({
    queryKey: ['attendance-class-absences', classId, from, to],
    queryFn: () => studentAttendance.getAbsentStudents(classId, from, to),
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
    </div>
  );
}
