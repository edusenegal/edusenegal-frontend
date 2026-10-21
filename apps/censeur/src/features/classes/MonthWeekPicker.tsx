import { useState } from 'react';
import { Button } from '@/components/ui';
import styles from './MonthWeekPicker.module.css';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Lundi de la semaine contenant `d` (dimanche compte comme fin de semaine, pas début). */
export function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return startOfDay(monday);
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function inWeek(d: Date, weekStart: Date): boolean {
  const end = addDays(weekStart, 6);
  return d >= weekStart && d <= end;
}

interface MonthWeekPickerProps {
  /** Lundi de la semaine actuellement affichée dans la grille d'emploi du temps. */
  weekStart: Date;
  onWeekChange(weekStart: Date): void;
}

/**
 * Vue mensuelle + sélection d'une semaine (nouvelle demande direction) —
 * l'emploi du temps est un modèle hebdomadaire RÉCURRENT côté backend (une
 * seule version active, pas une instance par semaine) : ce calendrier ne
 * charge donc rien de nouveau au clic, il sert uniquement à choisir QUELLE
 * semaine on regarde, pour calculer de vraies dates et griser ce qui est
 * passé (voir `ScheduleGrid`). Une semaine qui chevauche deux mois affiche
 * les jours du mois courant normalement et ceux du mois adjacent atténués.
 */
export function MonthWeekPicker({ weekStart, onWeekChange }: MonthWeekPickerProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
  const today = startOfDay(new Date());

  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const gridStart = mondayOf(firstOfMonth);
  const weeks: Date[][] = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    // Pas de 7e ligne si elle ne contient plus aucun jour du mois affiché.
    if (week[6]!.getMonth() !== visibleMonth.getMonth() && cursor.getMonth() !== visibleMonth.getMonth()) break;
  }

  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <Button variant="ghost" size="sm" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>
          ‹
        </Button>
        <strong className={styles.monthLabel}>
          {MOIS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
        </strong>
        <Button variant="ghost" size="sm" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>
          ›
        </Button>
        <Button variant="secondary" size="sm" onClick={() => { const monday = mondayOf(new Date()); onWeekChange(monday); setVisibleMonth(new Date(monday.getFullYear(), monday.getMonth(), 1)); }} style={{ marginLeft: 'auto' }}>
          Aujourd’hui
        </Button>
      </div>
      <div className={styles.daysHead}>
        {JOURS_COURTS.map((j) => (
          <span key={j}>{j}</span>
        ))}
      </div>
      {weeks.map((week, i) => {
        const isSelectedWeek = inWeek(weekStart, week[0]!) || sameDay(weekStart, week[0]!);
        return (
          <button
            type="button"
            key={i}
            className={[styles.weekRow, isSelectedWeek ? styles.weekSelected : ''].join(' ')}
            onClick={() => onWeekChange(week[0]!)}
          >
            {week.map((d) => (
              <span
                key={d.toISOString()}
                className={[
                  styles.day,
                  d.getMonth() !== visibleMonth.getMonth() ? styles.outside : '',
                  sameDay(d, today) ? styles.today : '',
                ].join(' ')}
              >
                {d.getDate()}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );
}
