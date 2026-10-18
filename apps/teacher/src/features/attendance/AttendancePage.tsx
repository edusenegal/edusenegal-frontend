import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Input, Select, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { todayISO } from '@/utils/format';
import type { AttendanceStatus, AttendanceStudentEntry } from '@/types/domain';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Présent',
  absent: 'Absent',
  retard: 'Retard',
  justifie: 'Justifié',
};
const STATUSES: AttendanceStatus[] = ['present', 'absent', 'retard', 'justifie'];

export default function AttendancePage() {
  const { myClasses, subjects, attendance } = useServices();
  const queryClient = useQueryClient();

  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'mine'], queryFn: () => subjects.listMine() });

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [period, setPeriod] = useState('08:00-10:00');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
    setSaved(false);
    markMutation.mutate();
  }

  return (
    <div>
      <PageHeader title="Appel" subtitle="Saisissez la présence des élèves pour un créneau." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Créneau" />
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
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
