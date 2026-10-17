import type { ScheduleSlot } from '@/types/domain';
import { addDays } from './MonthWeekPicker';
import styles from './ScheduleGrid.module.css';

const DAYS: ScheduleSlot['jour'][] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_INDEX: Record<ScheduleSlot['jour'], number> = {
  Lundi: 0, Mardi: 1, Mercredi: 2, Jeudi: 3, Vendredi: 4, Samedi: 5,
};
function slotEndDate(weekStart: Date, jour: ScheduleSlot['jour'], heureFin: string): Date {
  const [h, m] = heureFin.split(':').map(Number) as [number, number];
  const d = addDays(weekStart, DAY_INDEX[jour]);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Grille hebdomadaire — un jour par colonne, triée par heure de début.
 *
 * `weekStart` (nouvelle demande direction) : le modèle hebdomadaire est
 * RÉCURRENT côté backend (voir `MonthWeekPicker`), donc un même créneau
 * "Lundi 8h" existe identiquement chaque semaine — ce composant calcule la
 * date réelle de chaque créneau POUR LA SEMAINE CHOISIE afin de griser ce
 * qui est déjà passé (non cliquable) et de garder cliquable (→ modification)
 * ce qui ne l'est pas encore.
 */
export function ScheduleGrid({
  slots,
  weekStart,
  onSlotClick,
}: {
  slots: ScheduleSlot[];
  weekStart: Date;
  onSlotClick?: (slot: ScheduleSlot) => void;
}) {
  const now = new Date();
  const byDay = new Map<string, ScheduleSlot[]>();
  for (const day of DAYS) byDay.set(day, []);
  for (const slot of slots) byDay.get(slot.jour)?.push(slot);
  for (const list of byDay.values()) list.sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));

  return (
    <div className={styles.grid}>
      {DAYS.map((day) => {
        const date = addDays(weekStart, DAY_INDEX[day]);
        return (
          <div key={day} className={styles.col}>
            <div className={styles.dayHead}>
              {day}
              <span className={styles.dayDate}> {date.getDate()}</span>
            </div>
            {(byDay.get(day) ?? []).map((slot, i) => {
              const isPast = slot.kind === 'cours' && slotEndDate(weekStart, day, slot.heureFin) < now;
              const clickable = slot.kind === 'cours' && !isPast && Boolean(onSlotClick);
              return (
                <div
                  key={i}
                  className={[
                    slot.kind === 'cours' ? styles.slot : styles.free,
                    isPast ? styles.past : '',
                    clickable ? styles.clickable : '',
                  ].join(' ')}
                  onClick={clickable ? () => onSlotClick?.(slot) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                >
                  <span className={styles.time}>
                    {slot.heureDebut}–{slot.heureFin}
                  </span>
                  {slot.kind === 'cours' ? (
                    <>
                      <strong className={styles.matiere}>{slot.matiere}</strong>
                      {slot.professeur ? <span className={styles.salle}>{slot.professeur}</span> : null}
                      <span className={styles.salle}>{slot.salle}</span>
                      {isPast ? <span className={styles.pastTag}>Passé</span> : null}
                    </>
                  ) : (
                    <span className={styles.freeLabel}>Libre</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
