import { useId, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Table, type Column } from '@/components/ui';
import { fmtCompact, fmtXOF, periodLabelFull, periodLabelShort } from '@/utils/format';
import type { LedgerHistoryPoint } from '@/types/domain';
import styles from './EvolutionChart.module.css';

interface EvolutionChartProps {
  points: LedgerHistoryPoint[];
}

const WIDTH = 920;
const HEIGHT = 300;
const PAD_LEFT = 52;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;
const TICKS = 4;

/** Arrondit `max` au prochain multiple "propre" (1/2/5 × 10^n) pour des repères d'axe lisibles. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exponent = Math.floor(Math.log10(max));
  const base = Math.pow(10, exponent);
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    const candidate = step * base;
    if (candidate >= max) return candidate;
  }
  return 10 * base;
}

function xAt(index: number, count: number): number {
  if (count <= 1) return PAD_LEFT + PLOT_W / 2;
  return PAD_LEFT + (PLOT_W * index) / (count - 1);
}

function yAt(value: number, max: number): number {
  return PAD_TOP + PLOT_H - (PLOT_H * value) / max;
}

/**
 * Courbe d'évolution entrées / sorties — tracée en SVG inline (aucune
 * librairie de graphique dans ce dépôt). Deux séries, légende à clé-ligne,
 * repère croisé + infobulle au survol/focus, et une vue tableau accessible
 * en repli — voir la compétence `dataviz` pour les specs (traits 2px,
 * marqueurs ≥8px à anneau de surface, grilles 1px, cible de survol ≥24px).
 */
export function EvolutionChart({ points }: EvolutionChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tableView, setTableView] = useState(false);
  const titleId = useId();

  const max = useMemo(() => {
    const rawMax = points.reduce((acc, p) => Math.max(acc, p.entreesFcfa, p.sortiesFcfa), 0);
    return niceMax(rawMax);
  }, [points]);

  const entreesPath = useMemo(
    () => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i, points.length)},${yAt(p.entreesFcfa, max)}`).join(' '),
    [points, max],
  );
  const sortiesPath = useMemo(
    () => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i, points.length)},${yAt(p.sortiesFcfa, max)}`).join(' '),
    [points, max],
  );

  const gridLines = useMemo(
    () =>
      Array.from({ length: TICKS + 1 }, (_, i) => {
        const value = (max * i) / TICKS;
        return { value, y: yAt(value, max) };
      }),
    [max],
  );

  // Un point tous les N pour éviter que les libellés d'axe se chevauchent.
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  function nearestIndexFromClientX(clientX: number, svg: SVGSVGElement): number {
    const rect = svg.getBoundingClientRect();
    const scale = WIDTH / rect.width;
    const localX = (clientX - rect.left) * scale;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((_, i) => {
      const dist = Math.abs(xAt(i, points.length) - localX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    setHoverIndex(nearestIndexFromClientX(event.clientX, event.currentTarget));
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  const hoverX = hoverIndex != null ? xAt(hoverIndex, points.length) : null;

  const tableColumns: Column<LedgerHistoryPoint>[] = [
    { key: 'period', header: 'Période', render: (r) => periodLabelFull(r.period) },
    { key: 'entrees', header: 'Entrées', render: (r) => fmtXOF(r.entreesFcfa), align: 'right' },
    { key: 'sorties', header: 'Sorties', render: (r) => fmtXOF(r.sortiesFcfa), align: 'right' },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <ul className={styles.legend} aria-label="Séries affichées">
          <li>
            <span className={styles.lineKeySuccess} aria-hidden="true" />
            Entrées
          </li>
          <li>
            <span className={styles.lineKeyWarning} aria-hidden="true" />
            Sorties
          </li>
        </ul>
        <button type="button" className={styles.toggle} onClick={() => setTableView((v) => !v)}>
          {tableView ? 'Afficher le graphique' : 'Afficher en tableau'}
        </button>
      </div>

      {tableView ? (
        <Table columns={tableColumns} rows={points} rowKey={(r) => r.period} />
      ) : (
        <div className={styles.plotArea}>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className={styles.svg}
            role="img"
            aria-labelledby={titleId}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <title id={titleId}>Évolution des entrées et des sorties par période</title>

            {gridLines.map((g) => (
              <g key={g.value}>
                <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={g.y} y2={g.y} className={styles.gridline} />
                <text x={PAD_LEFT - 8} y={g.y} className={styles.axisLabel} textAnchor="end" dominantBaseline="middle">
                  {fmtCompact(g.value)}
                </text>
              </g>
            ))}

            {points.map((p, i) =>
              i % labelEvery === 0 || i === points.length - 1 ? (
                <text
                  key={p.period}
                  x={xAt(i, points.length)}
                  y={HEIGHT - PAD_BOTTOM + 18}
                  className={styles.axisLabel}
                  textAnchor="middle"
                >
                  {periodLabelShort(p.period)}
                </text>
              ) : null,
            )}

            {hoverX != null ? (
              <line x1={hoverX} x2={hoverX} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} className={styles.crosshair} />
            ) : null}

            <path d={sortiesPath} className={styles.lineWarning} />
            <path d={entreesPath} className={styles.lineSuccess} />

            {points.map((p, i) => (
              <circle
                key={`e-${p.period}`}
                cx={xAt(i, points.length)}
                cy={yAt(p.entreesFcfa, max)}
                r={4}
                className={styles.dotSuccess}
              />
            ))}
            {points.map((p, i) => (
              <circle
                key={`s-${p.period}`}
                cx={xAt(i, points.length)}
                cy={yAt(p.sortiesFcfa, max)}
                r={4}
                className={styles.dotWarning}
              />
            ))}

            {points.map((p, i) => (
              <rect
                key={`hit-${p.period}`}
                x={xAt(i, points.length) - PLOT_W / Math.max(points.length, 1) / 2}
                y={PAD_TOP}
                width={Math.max(PLOT_W / Math.max(points.length, 1), 24)}
                height={PLOT_H}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${periodLabelFull(p.period)} — entrées ${fmtXOF(p.entreesFcfa)}, sorties ${fmtXOF(p.sortiesFcfa)}`}
                onFocus={() => setHoverIndex(i)}
                onPointerEnter={() => setHoverIndex(i)}
              />
            ))}
          </svg>

          {hovered && hoverX != null ? (
            <div
              className={styles.tooltip}
              style={{ left: `${(hoverX / WIDTH) * 100}%` }}
              role="status"
            >
              <p className={styles.tooltipPeriod}>{periodLabelFull(hovered.period)}</p>
              <p className={styles.tooltipRow}>
                <span className={styles.lineKeySuccess} aria-hidden="true" />
                <strong>{fmtXOF(hovered.entreesFcfa)}</strong>
              </p>
              <p className={styles.tooltipRow}>
                <span className={styles.lineKeyWarning} aria-hidden="true" />
                <strong>{fmtXOF(hovered.sortiesFcfa)}</strong>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
