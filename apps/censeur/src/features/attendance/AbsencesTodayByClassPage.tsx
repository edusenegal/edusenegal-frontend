import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { frToISO, todayISO, exportCsv } from '@/utils/format';
import type { AbsenceRequestSummary, AbsentStudentEntry, ClassGroup } from '@/types/domain';
import styles from './AbsencesTodayByClassPage.module.css';

const STATUS_TONE = { ABSENT: 'danger', LATE: 'warning', PRESENT: 'success', JUSTIFIED: 'neutral' } as const;
const STATUS_LABEL = { ABSENT: 'Absent', LATE: 'Retard', PRESENT: 'Présent', JUSTIFIED: 'Justifié' } as const;

const REVIEW_TONE = { PENDING: 'warning', LOCKED: 'neutral', APPROVED: 'success', REJECTED: 'danger' } as const;
const REVIEW_LABEL = { PENDING: 'En attente', LOCKED: 'Verrouillée', APPROVED: 'Approuvée', REJECTED: 'Rejetée' } as const;

/** Une ligne de la liste "absents du jour" d'une classe, enrichie de la demande d'absence correspondante si elle existe (#427 — demande explicite). */
interface ClassAbsenceRow extends AbsentStudentEntry {
  absence: AbsenceRequestSummary | null;
}

/**
 * Classes → absents du jour → action directe — item #427 (demande explicite
 * censeur/surveillant général) : "voir la liste des classes et voir les
 * absents du jour et pouvoir effectuer une action sur une absence".
 *
 * Page séparée du flux "Demandes à traiter" (`AbsenceReviewPage`, par
 * classe/jour plutôt que par file d'attente plate) mais qui AGIT sur les
 * mêmes `AbsenceRequest` (`reviewAbsence`) — aucune nouvelle route backend :
 * on croise ici deux listes déjà existantes, toutes les deux scopées à
 * aujourd'hui : `getAbsentStudents(classId, today, today)` (déduit de
 * l'appel réel du professeur — fiable pour "qui est absent aujourd'hui") et
 * `listSchoolAbsences()` (les `AbsenceRequest`, créées automatiquement dès
 * qu'un élève est marqué ABSENT — c'est elles qu'on verrouille/approuve/
 * rejette). Un élève en LATE n'a jamais de `AbsenceRequest` (auto-création
 * limitée à ABSENT, voir `autoCreateAbsenceRequestIfMissing`) : il apparaît
 * donc ici sans action possible, ce qui est le comportement attendu.
 */
export default function AbsencesTodayByClassPage() {
  const { studentAttendance, classes } = useServices();
  const queryClient = useQueryClient();
  const today = todayISO();

  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // CORRECTION (signalé) "je ne vois aucune classe" : la liste venait de
  // getClassesStats(today, today), qui ne renvoie que les classes ayant déjà
  // une AttendanceRecord CE JOUR précis (voir
  // AttendanceServiceImpl#getSchoolClassesAttendanceStats — elle groupe les
  // classes à partir des séances existantes, elle n'énumère jamais le
  // référentiel des classes). Tant qu'aucun professeur n'a encore fait
  // l'appel aujourd'hui, cette liste est vide — ce n'était donc pas "0
  // absent" mais bien "aucune classe du tout". `classes.list()` (class-service)
  // donne le référentiel réel des classes de l'école, toujours peuplé.
  const classList = useQuery({
    queryKey: ['classes'],
    queryFn: () => classes.list(),
  });

  const absentToday = useQuery({
    queryKey: ['attendance-class-absences', selectedClass?.id, today],
    queryFn: () => studentAttendance.getAbsentStudents(selectedClass!.id, today, today),
    enabled: selectedClass != null,
  });

  // Toutes les demandes d'absence de l'école (PENDING/LOCKED en priorité —
  // ce sont les seules sur lesquelles une action a un sens) : une seule
  // requête, filtrée/croisée ci-dessous par élève + par date du jour.
  const schoolAbsences = useQuery({
    queryKey: ['school-absences-today-by-class'],
    queryFn: () => studentAttendance.listSchoolAbsences(),
    enabled: selectedClass != null,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' | 'LOCKED' }) => {
      setActionError(null);
      return studentAttendance.reviewAbsence(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-absences-today-by-class'] });
      queryClient.invalidateQueries({ queryKey: ['school-absences'] });
    },
    onError: (err: unknown) =>
      setActionError(err instanceof AppError ? err.message : "Impossible d'enregistrer la décision. Réessaie."),
  });

  const rows = useMemo<ClassAbsenceRow[]>(() => {
    const absences = schoolAbsences.data ?? [];
    return (absentToday.data ?? []).map((s) => ({
      ...s,
      absence:
        absences.find(
          (a) =>
            a.studentId === s.studentId &&
            (a.status === 'PENDING' || a.status === 'LOCKED') &&
            frToISO(a.dateFrom) <= today &&
            today <= frToISO(a.dateTo),
        ) ?? null,
    }));
  }, [absentToday.data, schoolAbsences.data, today]);

  const classColumns: Column<ClassGroup>[] = [
    { key: 'classe', header: 'Classe', render: (c) => c.name },
    { key: 'effectif', header: 'Effectif', render: (c) => String(c.effectif), align: 'right' },
  ];

  const rowColumns: Column<ClassAbsenceRow>[] = [
    { key: 'eleve', header: 'Élève', render: (r) => r.studentNom },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    {
      key: 'demande',
      header: "Demande d'absence",
      render: (r) =>
        r.absence ? (
          <span>
            <Badge tone={REVIEW_TONE[r.absence.status]}>{REVIEW_LABEL[r.absence.status]}</Badge>{' '}
            {r.absence.reason ? `— ${r.absence.reason}` : null}
            {r.absence.hasJustification ? ' 📎' : null}
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-faint)' }}>—</span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) =>
        r.absence ? (
          <div className={styles.actionRow}>
            {r.absence.status === 'PENDING' ? (
              <Button
                variant="secondary"
                size="sm"
                loading={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ id: r.absence!.id, status: 'LOCKED' })}
              >
                Verrouiller
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              loading={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({ id: r.absence!.id, status: 'APPROVED' })}
            >
              Approuver
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({ id: r.absence!.id, status: 'REJECTED' })}
            >
              Rejeter
            </Button>
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-faint)' }}>—</span>
        ),
    },
  ];

  const STATUS_LABEL_CSV: Record<string, string> = {
    ABSENT: 'Absent',
    LATE: 'Retard',
    PRESENT: 'Présent',
    JUSTIFIED: 'Justifié',
  };
  function exportAbsents() {
    if (!selectedClass) return;
    const headers = ['Élève', 'Statut', 'Note'];
    const data = rows.map((r) => [r.studentNom, STATUS_LABEL_CSV[r.status] ?? r.status, r.note ?? '']);
    exportCsv(`absents_${selectedClass.name}_${today}.csv`, headers, data);
  }

  return (
    <div>
      <Link to="/presence" className={styles.back}>
        ← Présence & absences
      </Link>
      <PageHeader
        title="Absents du jour — par classe"
        subtitle="Choisis une classe pour voir ses absents d'aujourd'hui et agir directement sur chaque absence."
      />

      <Card>
        <CardHeader title="Classes" />
        <StateView
          loading={classList.isLoading}
          error={classList.error}
          onRetry={() => classList.refetch()}
          empty={classList.data?.length === 0}
        >
          <Table
            columns={classColumns}
            rows={classList.data ?? []}
            rowKey={(c) => c.id}
            onRowClick={(c) => {
              setSelectedClass(c);
              setActionError(null);
            }}
          />
        </StateView>
      </Card>

      {selectedClass ? (
        <Card style={{ marginTop: 'var(--space-lg)' }}>
          <div className={styles.toolbar}>
            <CardHeader title={`Absents aujourd'hui — ${selectedClass.name}`} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" disabled={rows.length === 0} onClick={exportAbsents}>
                Exporter (CSV)
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedClass(null)}>
                Changer de classe
              </Button>
            </div>
          </div>

          {actionError ? <p className={styles.error}>{actionError}</p> : null}

          <StateView
            loading={absentToday.isLoading}
            error={absentToday.error}
            onRetry={() => {
              absentToday.refetch();
              schoolAbsences.refetch();
            }}
            empty={rows.length === 0}
            emptyLabel="Aucun absent ni retard aujourd'hui dans cette classe."
          >
            <Table columns={rowColumns} rows={rows} rowKey={(r) => r.studentId} />
          </StateView>
        </Card>
      ) : null}
    </div>
  );
}
