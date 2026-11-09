import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Field,
  Select,
  Sheet,
  StateView,
  StatTile,
  Table,
  Textarea,
  type Column,
} from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { AttendanceSessionStudent } from '@/types/domain';
import styles from './AttendanceSessionDetailPage.module.css';

const STATUS_TONE = { ABSENT: 'danger', LATE: 'warning', PRESENT: 'success', JUSTIFIED: 'neutral' } as const;
const STATUS_LABEL = { ABSENT: 'Absent', LATE: 'Retard', PRESENT: 'Présent', JUSTIFIED: 'Justifié' } as const;

const ABSENCE_STATUS_TONE = { PENDING: 'warning', LOCKED: 'neutral', APPROVED: 'success', REJECTED: 'danger' } as const;
const ABSENCE_STATUS_LABEL = { PENDING: 'En attente', LOCKED: 'Verrouillée', APPROVED: 'Approuvée', REJECTED: 'Rejetée' } as const;

/**
 * Détail d'un créneau précis — clic sur une ligne de "Par créneau" depuis
 * `AttendanceOverviewPage`/`AttendanceClassPage` (demande explicite) : liste
 * nommée des élèves de la classe sur CE créneau, et pour chaque absent,
 * l'état de sa demande à justifier (verrouillée = l'élève ne peut plus la
 * justifier lui-même ; 72h sans justificatif = enregistrée automatiquement
 * en absence confirmée côté backend). Clic sur un élève → corriger son état
 * et consulter/télécharger son justificatif.
 */
export default function AttendanceSessionDetailPage() {
  const { sessionId = '' } = useParams();
  const { studentAttendance } = useServices();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<AttendanceSessionStudent | null>(null);
  const [form, setForm] = useState<{ status: AttendanceSessionStudent['status']; note: string }>({
    status: 'PRESENT',
    note: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['attendance-session-detail', sessionId],
    queryFn: () => studentAttendance.getSessionDetail(sessionId),
  });
  const d = detail.data;

  const updateMutation = useMutation({
    mutationFn: ({ studentId, status, note }: { studentId: string; status: AttendanceSessionStudent['status']; note: string }) => {
      setFormError(null);
      return studentAttendance.updateStudentStatus(sessionId, studentId, status, note.trim() || null);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['attendance-session-detail', sessionId], updated);
      setTarget(null);
    },
    onError: (err: unknown) =>
      setFormError(err instanceof AppError ? err.message : "Impossible d'enregistrer l'état. Réessaie."),
  });

  const downloadMutation = useMutation({
    mutationFn: ({ absenceRequestId, studentNom }: { absenceRequestId: string; studentNom: string }) => {
      setDownloadError(null);
      return studentAttendance.downloadJustification(absenceRequestId, studentNom);
    },
    onError: (err: unknown) =>
      setDownloadError(err instanceof AppError ? err.message : 'Impossible de télécharger le justificatif. Réessaie.'),
  });

  const lockMutation = useMutation({
    mutationFn: (lock: boolean) =>
      lock ? studentAttendance.lockSession(sessionId) : studentAttendance.unlockSession(sessionId),
    onSuccess: (updated) => queryClient.setQueryData(['attendance-session-detail', sessionId], updated),
  });

  function openTarget(s: AttendanceSessionStudent) {
    setTarget(s);
    setForm({ status: s.status, note: s.note ?? '' });
    setFormError(null);
  }

  function submit() {
    if (!target) return;
    updateMutation.mutate({ studentId: target.studentId, status: form.status, note: form.note });
  }

  const columns: Column<AttendanceSessionStudent>[] = [
    { key: 'eleve', header: 'Élève', render: (s) => s.studentNom },
    { key: 'statut', header: 'Statut', render: (s) => <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge> },
    { key: 'note', header: 'Note', render: (s) => s.note ?? '—' },
    {
      key: 'justification',
      header: 'Justification',
      render: (s) => {
        if (s.status !== 'ABSENT' || !s.absenceRequestId) return <span style={{ color: 'var(--color-text-faint)' }}>—</span>;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {s.absenceStatus ? (
              <Badge tone={ABSENCE_STATUS_TONE[s.absenceStatus]}>{ABSENCE_STATUS_LABEL[s.absenceStatus]}</Badge>
            ) : null}
            {s.hasJustification ? (
              <Button
                variant="secondary"
                size="sm"
                loading={downloadMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  downloadMutation.mutate({ absenceRequestId: s.absenceRequestId!, studentNom: s.studentNom });
                }}
              >
                📎 Télécharger
              </Button>
            ) : (
              <span style={{ color: 'var(--color-text-faint)', fontSize: 12.5 }}>Non justifiée</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) => (
        <Button
          variant="secondary"
          size="sm"
          disabled={d?.locked}
          onClick={(e) => {
            e.stopPropagation();
            openTarget(s);
          }}
        >
          Changer l’état
        </Button>
      ),
    },
  ];

  return (
    <div>
      {d ? (
        <Link to={`/presence/classes/${d.classId}`} className={styles.back}>
          ← {d.className}
        </Link>
      ) : (
        <Link to="/presence" className={styles.back}>
          ← Présence & absences
        </Link>
      )}

      <PageHeader
        title={d ? `${d.matiere ?? 'Créneau'} — ${d.dayOfWeek} ${d.period}` : 'Détail du créneau'}
        subtitle={d ? `${d.date} · ${d.className}${d.professeur ? ` · ${d.professeur}` : ''}` : undefined}
        action={
          d ? (
            <Button
              variant={d.locked ? 'secondary' : 'primary'}
              loading={lockMutation.isPending}
              onClick={() => lockMutation.mutate(!d.locked)}
            >
              {d.locked ? 'Déverrouiller l’appel' : 'Verrouiller l’appel'}
            </Button>
          ) : undefined
        }
      />

      {d?.locked ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
          🔒 Appel verrouillé{d.lockedByNom ? ` par ${d.lockedByNom}` : ''} — le professeur ne peut plus
          modifier les états et les élèves ne peuvent plus justifier ces absences.
        </p>
      ) : null}

      {downloadError ? <p className={styles.error}>{downloadError}</p> : null}

      <StateView
        loading={detail.isLoading}
        error={detail.error}
        onRetry={() => detail.refetch()}
        empty={d?.students.length === 0}
      >
        {d ? (
          <>
            <div className={styles.grid}>
              <StatTile label="Effectif" value={String(d.totalStudents)} />
              <StatTile label="Présents" value={String(d.present)} tone="success" />
              <StatTile label="Absents" value={String(d.absent)} tone={d.absent > 0 ? 'danger' : 'success'} />
              <StatTile label="Retards" value={String(d.late)} tone={d.late > 0 ? 'warning' : 'success'} />
              <StatTile label="Taux de présence" value={`${d.attendanceRate.toFixed(0)}%`} />
            </div>
            <Table columns={columns} rows={d.students} rowKey={(s) => s.studentId} />
          </>
        ) : null}
      </StateView>

      <Sheet
        title={target ? target.studentNom : 'Élève'}
        open={target != null}
        onClose={() => setTarget(null)}
        width="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Annuler
            </Button>
            <Button variant="primary" loading={updateMutation.isPending} onClick={submit}>
              Enregistrer
            </Button>
          </>
        }
      >
        {target ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="État">
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AttendanceSessionStudent['status'] }))}
              >
                {(Object.keys(STATUS_LABEL) as AttendanceSessionStudent['status'][]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note">
              <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </Field>

            {target.status === 'ABSENT' && target.absenceRequestId ? (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Demande à justifier</p>
                <p style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {target.absenceStatus ? (
                    <Badge tone={ABSENCE_STATUS_TONE[target.absenceStatus]}>{ABSENCE_STATUS_LABEL[target.absenceStatus]}</Badge>
                  ) : null}
                  {target.absenceReason ? <span>{target.absenceReason}</span> : null}
                </p>
                {target.hasJustification ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={downloadMutation.isPending}
                    onClick={() =>
                      downloadMutation.mutate({ absenceRequestId: target.absenceRequestId!, studentNom: target.studentNom })
                    }
                  >
                    📎 Télécharger le justificatif
                  </Button>
                ) : (
                  <p style={{ fontSize: 12.5, color: 'var(--color-text-faint)' }}>
                    Aucun justificatif déposé — voir la file « Absences à traiter » pour verrouiller ou trancher.
                  </p>
                )}
              </div>
            ) : null}

            {formError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{formError}</p> : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
