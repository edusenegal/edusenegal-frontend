import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { TimetableSlot } from '@/types/domain';

const DAYS: TimetableSlot['jour'][] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function SchedulePage() {
  const { timetable } = useServices();
  const query = useQuery({ queryKey: ['timetable', 'mine'], queryFn: () => timetable.mine() });

  const byDay = new Map<string, TimetableSlot[]>();
  for (const slot of query.data ?? []) {
    const list = byDay.get(slot.jour) ?? [];
    list.push(slot);
    byDay.set(slot.jour, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
  }

  return (
    <div>
      <PageHeader title="Emploi du temps" subtitle="Vos créneaux de cours, toutes classes confondues." />
      <StateView loading={query.isLoading} error={query.error} empty={(query.data?.length ?? 0) === 0}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {DAYS.map((day) => (
            <Card key={day} padded>
              <h3 style={{ fontSize: 13.5, margin: '0 0 8px', color: 'var(--color-text-muted)' }}>{day}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(byDay.get(day) ?? []).map((slot, i) => (
                  <div key={i} style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                      {slot.heureDebut} – {slot.heureFin}
                    </div>
                    <div style={{ fontWeight: 600 }}>{slot.classe}</div>
                    <div style={{ fontSize: 12.5 }}>{slot.matiere ?? '—'}</div>
                    {slot.salle ? <div style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>Salle {slot.salle}</div> : null}
                    {slot.kind === 'remplacement' ? <Badge tone="warning">Remplacement</Badge> : null}
                  </div>
                ))}
                {(byDay.get(day) ?? []).length === 0 ? (
                  <p style={{ fontSize: 12.5, color: 'var(--color-text-faint)' }}>Aucun cours.</p>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </StateView>
    </div>
  );
}
