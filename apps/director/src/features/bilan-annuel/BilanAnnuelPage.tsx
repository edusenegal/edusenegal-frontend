import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { AnnualFigure, BilanAnnuel } from '@/types/domain';
import { fmtXOF, fmtPct } from '@/utils/format';
import styles from './BilanAnnuelPage.module.css';

/* ── helpers deltas ───────────────────────────────────────────── */
function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
/** `true` = bon, `false` = mauvais, `null` = pas de comparaison. Pour les dépenses, baisse = bon. */
function trend(f: AnnualFigure, lowerIsBetter = false): boolean | null {
  if (f.variationPct === null) return null;
  const up = f.variationPct >= 0;
  return lowerIsBetter ? !up : up;
}
function deltaText(f: AnnualFigure, suffix = ''): string | null {
  if (f.variationPct === null) return null;
  return `${signed(f.variationPct)}%${suffix}`;
}

/* ── petits graphes ───────────────────────────────────────────── */
function Ring({ pct, color }: { pct: number; color: string }) {
  const R = 30;
  const c = 2 * Math.PI * R;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className={styles.ring} aria-hidden="true">
      <circle cx="38" cy="38" r={R} fill="none" stroke="var(--color-border)" strokeWidth="8" />
      <circle
        cx="38"
        cy="38"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 38 38)"
      />
      <text x="38" y="43" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--color-text)" fontFamily="Space Grotesk, Inter, sans-serif">
        {Math.round(pct)}
      </text>
    </svg>
  );
}

function PresenceDonut({ present, absent, retard }: { present: number; absent: number; retard: number }) {
  const total = present + absent + retard;
  const segs = [
    { v: present, c: 'var(--color-success)', l: 'Présences' },
    { v: retard, c: 'var(--color-warning)', l: 'Retards' },
    { v: absent, c: 'var(--color-danger)', l: 'Absences' },
  ];
  const R = 52;
  const r = 32;
  const cx = 64;
  const cy = 64;
  let acc = 0;
  const paths =
    total > 0
      ? segs
          .filter((s) => s.v > 0)
          .map((s, i) => {
            const a0 = (acc / total) * 2 * Math.PI - Math.PI / 2;
            acc += s.v;
            const a1 = (acc / total) * 2 * Math.PI - Math.PI / 2;
            const large = s.v / total > 0.5 ? 1 : 0;
            const X = (a: number, rr: number) => cx + rr * Math.cos(a);
            const Y = (a: number, rr: number) => cy + rr * Math.sin(a);
            return (
              <path
                key={i}
                d={`M${X(a0, R)} ${Y(a0, R)} A${R} ${R} 0 ${large} 1 ${X(a1, R)} ${Y(a1, R)} L${X(a1, r)} ${Y(a1, r)} A${r} ${r} 0 ${large} 0 ${X(a0, r)} ${Y(a0, r)} Z`}
                fill={s.c}
              />
            );
          })
      : [<circle key="e" cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke="var(--color-border)" strokeWidth={R - r} />];
  const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
  return (
    <div className={styles.donutWrap}>
      <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden="true">
        {paths}
        <text x="64" y="60" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--color-text)" fontFamily="Space Grotesk, Inter, sans-serif">
          {total > 0 ? `${rate}%` : '—'}
        </text>
        <text x="64" y="77" textAnchor="middle" fontSize="9.5" fill="var(--color-text-faint)">
          présence
        </text>
      </svg>
      <div className={styles.legend}>
        {segs.map((s) => (
          <span key={s.l}>
            <i className={styles.dotc} style={{ background: s.c }} />
            {s.l} · {s.v.toLocaleString('fr-FR')}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── tuiles ────────────────────────────────────────────────────── */
function Kpi({ label, value, unit, figure, lowerIsBetter, lead, suffix }: {
  label: string;
  value: string;
  unit?: string;
  figure: AnnualFigure;
  lowerIsBetter?: boolean;
  lead?: boolean;
  suffix?: string;
}) {
  const good = trend(figure, lowerIsBetter);
  const dt = deltaText(figure, suffix);
  return (
    <div className={`${styles.kpi} ${lead ? styles.kpiLead : ''}`}>
      <div className={styles.ct}>{label}</div>
      <div className={styles.kpiV}>{value}</div>
      {unit ? <div className={styles.kpiU}>{unit}</div> : null}
      {dt ? (
        <div className={`${styles.delta} ${good ? styles.up : styles.down}`}>
          {figure.variationPct! >= 0 ? '▲' : '▼'} {dt}
        </div>
      ) : (
        <div className={`${styles.delta} ${styles.flat}`}>— 1ʳᵉ année</div>
      )}
    </div>
  );
}

export default function BilanAnnuelPage() {
  const { bilanAnnuel } = useServices();
  const bilan = useQuery({ queryKey: ['bilan-annuel'], queryFn: () => bilanAnnuel.getBilan() });
  const b = bilan.data;

  return (
    <div>
      <PageHeader
        title="Bilan annuel"
        subtitle={
          b
            ? b.anneePrecedente
              ? `${b.anneeActuelle}, comparée à ${b.anneePrecedente}.`
              : `${b.anneeActuelle} — pas encore d’année précédente pour cet établissement.`
            : 'Vue d’ensemble de l’année en cours, comparée à l’année précédente.'
        }
      />

      <StateView loading={bilan.isLoading} error={bilan.error} onRetry={() => bilan.refetch()}>
        {b ? <Content b={b} /> : null}
      </StateView>
    </div>
  );
}

function Content({ b }: { b: BilanAnnuel }) {
  const marge = b.recettes.valeurActuelle > 0 ? Math.round((b.solde.valeurActuelle / b.recettes.valeurActuelle) * 100) : 0;
  const maxNiveau = Math.max(1, ...b.reussiteParNiveau.map((n) => n.taux));

  const facts = buildFacts(b);

  return (
    <div className={styles.page}>
      {/* KPIs */}
      <div className={styles.kpis}>
        <Kpi label="Effectif" value={String(b.effectif.valeurActuelle)} unit="élèves" figure={b.effectif} lead />
        <Kpi label="Taux de réussite" value={`${b.tauxReussite.valeurActuelle}%`} unit="tous niveaux" figure={b.tauxReussite} suffix=" pts" />
        <Kpi label="Moyenne générale" value={b.moyenneGenerale.valeurActuelle.toFixed(1).replace('.', ',')} unit="/ 20" figure={b.moyenneGenerale} />
        <Kpi label="Solde" value={fmtXOF(b.solde.valeurActuelle)} figure={b.solde} />
        <Kpi label="Taux de présence" value={`${fmtPct(b.tauxPresence.valeurActuelle)}%`} unit="assiduité" figure={b.tauxPresence} suffix=" pts" />
      </div>

      {/* Réussite par niveau + Assiduité */}
      <div className={styles.row2}>
        <div className={styles.card}>
          <div className={styles.ct}>Taux de réussite par niveau</div>
          {b.reussiteParNiveau.length ? (
            <div className={styles.blist}>
              {b.reussiteParNiveau.map((n) => (
                <div className={styles.brow} key={n.niveau}>
                  <span className={styles.blbl}>{n.niveau}</span>
                  <span className={styles.track}>
                    <span className={styles.fill} style={{ width: `${(n.taux / maxNiveau) * 100}%` }} />
                  </span>
                  <span className={styles.bpc}>{n.taux}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.muted}>Résultats annuels pas encore calculés.</p>
          )}
        </div>
        <div className={styles.card}>
          <div className={styles.ct}>Assiduité de l’année</div>
          <PresenceDonut present={b.presence.present} absent={b.presence.absent} retard={b.presence.retard} />
        </div>
      </div>

      {/* Finances + Faits marquants */}
      <div className={styles.row2}>
        <div className={styles.card}>
          <div className={styles.ct}>Finances</div>
          <div className={styles.finrow}>
            <FinBar label="Recettes" value={b.recettes.valeurActuelle} max={Math.max(b.recettes.valeurActuelle, b.depenses.valeurActuelle, 1)} color="var(--color-success)" />
            <FinBar label="Dépenses" value={b.depenses.valeurActuelle} max={Math.max(b.recettes.valeurActuelle, b.depenses.valeurActuelle, 1)} color="var(--color-warning)" />
          </div>
          <div className={styles.soldeline}>
            <span>Solde</span>
            <b className={b.solde.valeurActuelle >= 0 ? styles.pos : styles.neg}>{fmtXOF(b.solde.valeurActuelle)}</b>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.ct}>Faits marquants</div>
          <div className={styles.facts}>
            {facts.map((f, i) => (
              <div className={styles.fact} key={i}>
                <span className={`${styles.fchip} ${f.up ? styles.fup : styles.fdown}`}>{f.up ? '↑' : '↓'}</span>
                <span>
                  <b>{f.title}</b> — <span className={styles.muted}>{f.sub}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scorecards par domaine */}
      <div className={styles.ct} style={{ marginTop: 4 }}>Par domaine</div>
      <div className={styles.row3}>
        <Scorecard
          title="Pédagogie"
          pct={b.tauxReussite.valeurActuelle}
          color="var(--brand-primary)"
          syn={pedaSyn(b)}
          mini={[
            ['Réussite', `${b.tauxReussite.valeurActuelle}%`],
            ['Moy. générale', b.moyenneGenerale.valeurActuelle.toFixed(1).replace('.', ',')],
            ['Mentions', String(b.mentions)],
          ]}
        />
        <Scorecard
          title="Finances"
          pct={marge}
          color="var(--color-info)"
          syn={finSyn(b, marge)}
          mini={[
            ['Recettes', fmtXOF(b.recettes.valeurActuelle)],
            ['Dépenses', fmtXOF(b.depenses.valeurActuelle)],
            ['Taux de marge', `${marge}%`],
          ]}
        />
        <Scorecard
          title="Vie scolaire"
          pct={b.tauxPresence.valeurActuelle}
          color="var(--color-success)"
          syn={vieSyn(b)}
          mini={[
            ['Présence', `${fmtPct(b.tauxPresence.valeurActuelle)}%`],
            ['Retards', `${b.tauxRetard}%`],
            ['Effectif', String(b.effectif.valeurActuelle)],
          ]}
        />
      </div>
    </div>
  );
}

function FinBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className={styles.finbar}>
      <div className={styles.finhead}>
        <span>{label}</span>
        <b>{fmtXOF(value)}</b>
      </div>
      <span className={styles.track}>
        <span className={styles.fill} style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
    </div>
  );
}

function Scorecard({ title, pct, color, syn, mini }: { title: string; pct: number; color: string; syn: string; mini: [string, string][] }) {
  return (
    <div className={styles.card}>
      <div className={styles.score}>
        <Ring pct={pct} color={color} />
        <div className={styles.scoreBody}>
          <h3 className={styles.scoreH}>{title}</h3>
          <span className={styles.ct}>score {Math.round(pct)}/100</span>
          <p className={styles.syn}>{syn}</p>
        </div>
      </div>
      <div className={styles.mini}>
        {mini.map(([k, v]) => (
          <div className={styles.m} key={k}>
            <b>{v}</b>
            {k}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── synthèses & faits (dérivés des données) ──────────────────── */
function buildFacts(b: BilanAnnuel): { up: boolean; title: string; sub: string }[] {
  const out: { up: boolean; title: string; sub: string }[] = [];
  if (b.effectif.variationPct !== null) {
    const diff = b.effectif.valeurActuelle - (b.effectif.valeurPrecedente ?? 0);
    out.push({ up: diff >= 0, title: `${signed(diff)} élèves`, sub: `vs ${b.anneePrecedente} (${b.effectif.valeurPrecedente} → ${b.effectif.valeurActuelle})` });
  }
  if (b.tauxReussite.variationPct !== null) out.push({ up: b.tauxReussite.variationPct >= 0, title: `Réussite ${signed(b.tauxReussite.variationPct)} pts`, sub: `${b.tauxReussite.valeurActuelle}% cette année` });
  if (b.solde.variationPct !== null) out.push({ up: b.solde.variationPct >= 0, title: `Solde ${signed(b.solde.variationPct)}%`, sub: `${fmtXOF(b.solde.valeurActuelle)} de trésorerie` });
  if (b.tauxPresence.variationPct !== null) out.push({ up: b.tauxPresence.variationPct >= 0, title: `Présence ${signed(b.tauxPresence.variationPct)} pts`, sub: `assiduité à ${fmtPct(b.tauxPresence.valeurActuelle)}%` });
  if (out.length === 0) {
    // première année : pas de comparaison → on met en avant les valeurs clés
    out.push({ up: true, title: `Réussite ${b.tauxReussite.valeurActuelle}%`, sub: `moyenne générale ${b.moyenneGenerale.valeurActuelle.toFixed(1).replace('.', ',')}/20` });
    out.push({ up: b.solde.valeurActuelle >= 0, title: `Solde ${fmtXOF(b.solde.valeurActuelle)}`, sub: 'première année suivie' });
    out.push({ up: true, title: `${b.effectif.valeurActuelle} élèves`, sub: `présence ${fmtPct(b.tauxPresence.valeurActuelle)}%` });
  }
  return out.slice(0, 5);
}
function pedaSyn(b: BilanAnnuel): string {
  const d = b.tauxReussite.variationPct;
  const base = `Réussite ${b.tauxReussite.valeurActuelle}%, moyenne générale ${b.moyenneGenerale.valeurActuelle.toFixed(1).replace('.', ',')}/20`;
  if (d === null) return `${base}. Première année suivie.`;
  return d >= 0 ? `${base} — en hausse de ${d} pts.` : `${base} — en baisse de ${Math.abs(d)} pts, à surveiller.`;
}
function finSyn(b: BilanAnnuel, marge: number): string {
  const sain = b.solde.valeurActuelle >= 0;
  return sain ? `Excédent de ${fmtXOF(b.solde.valeurActuelle)} (marge ${marge}%). Marge pour investir.` : `Déficit de ${fmtXOF(Math.abs(b.solde.valeurActuelle))} — dépenses à maîtriser.`;
}
function vieSyn(b: BilanAnnuel): string {
  return `Assiduité à ${fmtPct(b.tauxPresence.valeurActuelle)}%, ${b.tauxRetard}% de retards sur l’année.`;
}
