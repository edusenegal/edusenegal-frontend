import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { initials } from '@/utils/format';
import { useServices } from '@/hooks/useServices';
import { StateView } from '@/components/ui';
import type { Mention, StudentStatus, SubjectAverage } from '@/types/domain';
import styles from './StudentGradesTab.module.css';

const MENTION_LABEL: Record<Mention, string> = {
  excellent: 'Excellent',
  tres_bien: 'Très bien',
  bien: 'Bien',
  assez_bien: 'Assez bien',
  passable: 'Passable',
  insuffisant: 'Insuffisant',
};
const STATUS_LABEL: Record<StudentStatus, string> = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  transfere: 'Transféré',
};

/** Palier couleur d'une note /20 — classe CSS du chip. */
type Tier = 'exc' | 'tb' | 'b' | 'ab' | 'ins' | 'empty';
function tier(v: number | null): Tier {
  if (v == null) return 'empty';
  if (v >= 16) return 'exc';
  if (v >= 14) return 'tb';
  if (v >= 12) return 'b';
  if (v >= 10) return 'ab';
  return 'ins';
}
const TIER_CLASS: Record<Tier, string | undefined> = {
  exc: styles.gExc,
  tb: styles.gTb,
  b: styles.gB,
  ab: styles.gAb,
  ins: styles.gIns,
  empty: styles.gEmpty,
};
const MENTION_TIER: Record<Mention, Tier> = {
  excellent: 'exc',
  tres_bien: 'tb',
  bien: 'b',
  assez_bien: 'ab',
  passable: 'ab',
  insuffisant: 'ins',
};

function fmt(v: number | null | undefined): string {
  if (v == null) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
}

interface Props {
  studentId: string;
}

export function StudentGradesTab({ studentId }: Props) {
  const { academicResults, students } = useServices();

  const studentQuery = useQuery({ queryKey: ['student', studentId], queryFn: () => students.get(studentId) });
  const student = studentQuery.data;
  const classeId = student?.classeId ?? null;

  const configQuery = useQuery({
    queryKey: ['academic-config', classeId ?? ''],
    queryFn: () => academicResults.getEffectiveConfig(classeId ?? undefined),
    enabled: !!classeId,
  });
  const semCount = Math.min(Math.max(configQuery.data?.semesterCount ?? 2, 1), 4);
  const periodLabel = configQuery.data?.periodType === 'trimestre' ? 'Trimestre' : 'Semestre';

  const [sem, setSem] = useState(1);
  const [view, setView] = useState<'subject' | 'type'>('subject');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [photoFailed, setPhotoFailed] = useState(false);

  const resultQuery = useQuery({
    queryKey: ['student-semester-result', studentId, sem],
    queryFn: () => academicResults.getStudentSemesterResult(studentId, sem),
  });
  const result = resultQuery.data;

  const matieres = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = result?.matieres ?? [];
    return term ? list.filter((m) => m.subjectNom.toLowerCase().includes(term)) : list;
  }, [result, q]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const semesters = Array.from({ length: semCount }, (_, i) => i + 1);
  const fullName = student ? `${student.prenom} ${student.nom}` : '…';

  return (
    <div className={styles.wrap}>
      {/* Bandeau d'identité + KPIs */}
      <div className={styles.hero}>
        {student?.photoUrl && !photoFailed ? (
          <img src={student.photoUrl} alt={fullName} className={styles.avatarImg} onError={() => setPhotoFailed(true)} />
        ) : (
          <div className={styles.avatar} aria-hidden="true">
            {student ? initials(fullName) : '…'}
          </div>
        )}
        <div className={styles.idblock}>
          <h2 className={styles.name}>{fullName}</h2>
          {student ? (
            <div className={styles.idmeta}>
              <span>{student.classe}</span>
              <span className={styles.dot} />
              <span>Né(e) le {student.dateNaissance}</span>
              <span className={styles.dot} />
              <span>{STATUS_LABEL[student.statut]}</span>
            </div>
          ) : null}
        </div>
        <div className={styles.kpis}>
          <div className={`${styles.kpi} ${styles.kpiLead}`}>
            <div className={styles.kpiV}>{result ? `${fmt(result.moyenneGenerale)}/20` : '—'}</div>
            <div className={styles.kpiL}>Moyenne</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiV}>
              {result ? result.rangClasse : '—'}
              {result ? <span className={styles.kpiSub}> / {result.totalEleves}</span> : null}
            </div>
            <div className={styles.kpiL}>Rang</div>
          </div>
          <div className={styles.kpi}>
            <div className={`${styles.kpiV} ${styles.kpiMention}`}>{result ? MENTION_LABEL[result.mention] : '—'}</div>
            <div className={styles.kpiL}>Mention</div>
          </div>
        </div>
      </div>

      {/* Contrôles */}
      <div className={styles.controls}>
        <div className={styles.seg} role="tablist" aria-label={periodLabel}>
          {semesters.map((n) => (
            <button key={n} role="tab" aria-selected={sem === n} className={sem === n ? styles.segOn : ''} onClick={() => setSem(n)}>
              {periodLabel} {n}
            </button>
          ))}
        </div>
        <div className={`${styles.seg} ${styles.ghost}`} role="tablist" aria-label="Regroupement">
          <button role="tab" aria-selected={view === 'subject'} className={view === 'subject' ? styles.segOn : ''} onClick={() => setView('subject')}>
            Par matière
          </button>
          <button role="tab" aria-selected={view === 'type'} className={view === 'type' ? styles.segOn : ''} onClick={() => setView('type')}>
            Par type d’éval.
          </button>
        </div>
        <label className={styles.search}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Filtrer une matière…" autoComplete="off" />
        </label>
      </div>

      {/* Légende */}
      <div className={styles.legend}>
        <span className={styles.lg}><b>D1</b> Devoir 1</span>
        <span className={styles.lg}><b>D2</b> Devoir 2</span>
        <span className={styles.lg}><b>Compo</b> Composition</span>
        <span className={`${styles.lg} ${styles.lgMuted}`}>Moy. matière = (D1 + D2 + 2×Compo) ⁄ 4</span>
      </div>

      <StateView
        loading={resultQuery.isLoading}
        error={resultQuery.error}
        onRetry={() => resultQuery.refetch()}
        empty={!result}
        emptyLabel={`Les résultats du ${periodLabel.toLowerCase()} ${sem} ne sont pas encore disponibles.`}
      >
        {result ? (
          matieres.length === 0 ? (
            <div className={styles.emptyState}>Aucune matière ne correspond à « {q} ».</div>
          ) : view === 'subject' ? (
            <div className={styles.list} key={`s-${sem}`}>
              {matieres.map((m) => (
                <SubjectRow key={m.subjectId} m={m} open={open.has(m.subjectId)} onToggle={() => toggle(m.subjectId)} />
              ))}
              <div className={styles.footline}>
                <span className={styles.footlbl}>Moyenne générale du {periodLabel.toLowerCase()}</span>
                <span className={styles.footbig}>
                  {fmt(result.moyenneGenerale)}
                  <small> / 20</small>
                </span>
              </div>
            </div>
          ) : (
            <div key={`t-${sem}`}>
              <TypeBlock label="Devoir 1" pick={(m) => m.d1} list={matieres} />
              <TypeBlock label="Devoir 2" pick={(m) => m.d2} list={matieres} />
              <TypeBlock label="Composition" pick={(m) => m.composition} list={matieres} />
            </div>
          )
        ) : null}
      </StateView>
    </div>
  );
}

/* ---- ligne matière (vue par matière) ---- */
function Chip({ label, v }: { label: string; v: number | null }) {
  return (
    <div className={`${styles.chip} ${TIER_CLASS[tier(v)] ?? ''}`}>
      <small>{label}</small>
      {fmt(v)}
    </div>
  );
}

function SubjectRow({ m, open, onToggle }: { m: SubjectAverage; open: boolean; onToggle: () => void }) {
  return (
    <div className={`${styles.subj} ${open ? styles.subjOpen : ''}`}>
      <div
        className={styles.srow}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle())}
      >
        <div className={styles.sname}>
          <div className={styles.sn}>
            {m.subjectNom} <span className={styles.coef}>coef {m.coefficient}</span>
          </div>
        </div>
        <div className={styles.grades}>
          <Chip label="D1" v={m.d1} />
          <Chip label="D2" v={m.d2} />
          <Chip label="Compo" v={m.composition} />
          <div className={`${styles.chip} ${styles.moy} ${TIER_CLASS[tier(m.moyenne)] ?? ''}`}>
            <small>Moy</small>
            {fmt(m.moyenne)}
          </div>
          <svg className={styles.chev} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </div>
      </div>
      <div className={styles.detail}>
        <div className={styles.detailIn}>
          <div className={styles.dcell}>
            <div className={styles.dk}>Moyenne matière</div>
            <div className={styles.dv}>{fmt(m.moyenne)} / 20</div>
          </div>
          <div className={styles.dcell}>
            <div className={styles.dk}>Mention</div>
            <div className={styles.dv}>
              <span className={`${styles.mentionpill} ${TIER_CLASS[MENTION_TIER[m.mention]] ?? ''}`}>{MENTION_LABEL[m.mention]}</span>
            </div>
          </div>
          <div className={styles.dcell}>
            <div className={styles.dk}>Points pondérés</div>
            <div className={styles.dv}>
              {fmt(m.pointsPonderes)} <span className={styles.dfaint}>(moy × coef {m.coefficient})</span>
            </div>
          </div>
          <div className={styles.dcell}>
            <div className={styles.dk}>Calcul</div>
            <div className={`${styles.dv} ${styles.dcalc}`}>
              ({fmt(m.d1)} + {fmt(m.d2)} + 2×{fmt(m.composition)}) ⁄ 4
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- vue par type d'évaluation ---- */
function TypeBlock({ label, pick, list }: { label: string; pick: (m: SubjectAverage) => number | null; list: SubjectAverage[] }) {
  const vals = list.map(pick).filter((v): v is number => v != null);
  const moy = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return (
    <div className={styles.typegroup}>
      <h3 className={styles.typeh}>
        {label} <span className={styles.tag}>moyenne {fmt(moy)}/20</span>
      </h3>
      <div className={styles.list}>
        {list.map((m) => (
          <div className={styles.subj} key={m.subjectId}>
            <div className={`${styles.srow} ${styles.srowStatic}`}>
              <div className={styles.sname}>
                <div className={styles.sn}>
                  {m.subjectNom} <span className={styles.coef}>coef {m.coefficient}</span>
                </div>
              </div>
              <div className={styles.grades}>
                <Chip label={label.slice(0, 5)} v={pick(m)} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
