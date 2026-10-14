import type { ScheduleSlot } from '@/types/domain';
import styles from './ScheduleGrid.module.css';

const DAYS: ScheduleSlot['jour'][] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** Grille hebdomadaire — un jour par colonne, triée par heure de début. */
export function ScheduleGrid({ slots }: { slots: ScheduleSlot[] }) {
  const byDay = new Map<string, ScheduleSlot[]>();
  for (const day of DAYS) byDay.set(day, []);
  for (const slot of slots) byDay.get(slot.jour)?.push(slot);
  for (const list of byDay.values()) list.sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));

  return (
    <div className={styles.grid}>
      {DAYS.map((day) => (
        <div key={day} className={styles.col}>
          <div className={styles.dayHead}>{day}</div>
          {(byDay.get(day) ?? []).map((slot, i) => (
            <div key={i} className={slot.kind === 'cours' ? styles.slot : styles.free}>
              <span className={styles.time}>
                {slot.heureDebut}–{slot.heureFin}
              </span>
              {slot.kind === 'cours' ? (
                <>
                  <strong className={styles.matiere}>{slot.matiere}</strong>
                  <span className={styles.salle}>{slot.salle}</span>
                </>
              ) : (
                <span className={styles.freeLabel}>Libre</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
