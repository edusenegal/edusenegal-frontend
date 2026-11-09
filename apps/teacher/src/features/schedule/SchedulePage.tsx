import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Segmented, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { exportCsv } from '@/utils/format';
import type { TimetableSlot } from '@/types/domain';
import { SlotDetailSheet } from './SlotDetailSheet';

const DAYS: TimetableSlot['jour'][] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** `Date#getDay()` (0 = dimanche) → libellé du jour, même convention que `DAYS`. */
const WEEKDAY_FROM_JS_DAY: Record<number, TimetableSlot['jour'] | null> = {
  0: null, // dimanche — jamais de cours dans ce modèle
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

const MONTH_LABEL = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // Grille calée sur un lundi (convention scolaire sénégalaise), 6 semaines complètes.
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = lundi
  const start = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

const WEEKDAY_INDEX: Record<TimetableSlot['jour'], number> = {
  Lundi: 0,
  Mardi: 1,
  Mercredi: 2,
  Jeudi: 3,
  Vendredi: 4,
  Samedi: 5,
  Dimanche: 6,
};

/**
 * La vue "Semaine" n'a pas de navigation (toujours la semaine en cours) —
 * on peut donc déduire une vraie date pour chaque créneau récurrent, utile
 * pour savoir si son horaire est déjà passé (voir `SlotDetailSheet`).
 */
function dateForWeekdayThisWeek(day: TimetableSlot['jour']): Date {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7; // 0 = lundi
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + WEEKDAY_INDEX[day]);
}

export default function SchedulePage() {
  const { timetable } = useServices();
  const query = useQuery({ queryKey: ['timetable', 'mine'], queryFn: () => timetable.mine() });
  function exportSchedule() {
    const headers = ['Jour', 'Début', 'Fin', 'Classe', 'Matière', 'Salle'];
    const rows = (query.data ?? []).map((sl) => [sl.jour, sl.heureDebut, sl.heureFin, sl.classe, sl.matiere ?? '', sl.salle ?? '']);
    exportCsv('emploi_du_temps.csv', headers, rows);
  }

  const [view, setView] = useState<'semaine' | 'mois'>('semaine');
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, TimetableSlot[]>();
    for (const slot of query.data ?? []) {
      const list = map.get(slot.jour) ?? [];
      list.push(slot);
      map.set(slot.jour, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
    }
    return map;
  }, [query.data]);

  const days = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  function slotCard(slot: TimetableSlot, key: string | number, date: Date) {
    return (
      <button
        key={key}
        type="button"
        onClick={() => {
          setSelectedSlot(slot);
          setSelectedSlotDate(date);
        }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '8px 10px',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          background: 'var(--color-surface)',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          {slot.heureDebut} – {slot.heureFin}
        </div>
        <div style={{ fontWeight: 600 }}>{slot.classe}</div>
        <div style={{ fontSize: 12.5 }}>{slot.matiere ?? '—'}</div>
        {slot.salle ? <div style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>Salle {slot.salle}</div> : null}
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {slot.kind === 'remplacement' ? <Badge tone="warning">Remplacement</Badge> : null}
          {slot.description ? <Badge tone="info">Note</Badge> : null}
        </div>
      </button>
    );
  }

  return (
    <div>
      <PageHeader
        title="Emploi du temps"
        subtitle="Vos créneaux de cours, toutes classes confondues. Cliquez un créneau pour voir ou modifier son détail."
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={(query.data?.length ?? 0) === 0}
              onClick={exportSchedule}
            >
              Exporter (CSV)
            </Button>
            <Segmented
              options={[
                { value: 'semaine', label: 'Semaine' },
                { value: 'mois', label: 'Mois' },
              ]}
              value={view}
              onChange={(v) => setView(v)}
            />
          </div>
        }
      />
      <StateView loading={query.isLoading} error={query.error} empty={(query.data?.length ?? 0) === 0}>
        {view === 'semaine' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {DAYS.map((day) => (
              <Card key={day} padded>
                <h3 style={{ fontSize: 13.5, margin: '0 0 8px', color: 'var(--color-text-muted)' }}>{day}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(byDay.get(day) ?? []).map((slot, i) => slotCard(slot, i, dateForWeekdayThisWeek(day)))}
                  {(byDay.get(day) ?? []).length === 0 ? (
                    <p style={{ fontSize: 12.5, color: 'var(--color-text-faint)' }}>Aucun cours.</p>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              >
                ← Mois précédent
              </Button>
              <strong style={{ textTransform: 'capitalize' }}>{MONTH_LABEL.format(cursor)}</strong>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              >
                Mois suivant →
              </Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                <div key={d} style={{ fontSize: 11.5, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  {d}
                </div>
              ))}
              {days.map((date) => {
                const weekday = WEEKDAY_FROM_JS_DAY[date.getDay()];
                const slots = weekday ? (byDay.get(weekday) ?? []) : [];
                const inMonth = date.getMonth() === cursor.getMonth();
                return (
                  <div
                    key={date.toISOString()}
                    style={{
                      minHeight: 90,
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      padding: 6,
                      opacity: inMonth ? 1 : 0.4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{date.getDate()}</div>
                    {slots.map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setSelectedSlotDate(date);
                        }}
                        style={{
                          fontSize: 11,
                          textAlign: 'left',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: 'none',
                          background: 'var(--brand-primary)',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                        title={`${slot.heureDebut}–${slot.heureFin} · ${slot.classe}`}
                      >
                        {slot.heureDebut} {slot.matiere ?? slot.classe}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </StateView>

      <SlotDetailSheet
        slot={selectedSlot}
        slotDate={selectedSlotDate}
        onClose={() => {
          setSelectedSlot(null);
          setSelectedSlotDate(null);
        }}
      />
    </div>
  );
}
