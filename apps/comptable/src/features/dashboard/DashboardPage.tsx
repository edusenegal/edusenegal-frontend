import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, DateInput, Field, Segmented, Select, StateView, StatTile, type SegmentedOption } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF, todayISO } from '@/utils/format';
import { exportLedgerHistoryToExcel, type LedgerExportScope } from '@/utils/exportLedger';
import type { LedgerGranularity } from '@/types/domain';
import { EvolutionChart } from './EvolutionChart';
import styles from './DashboardPage.module.css';

const GRANULARITY_LABEL: Record<LedgerGranularity, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  year: 'Année',
};

const SCOPE_OPTIONS: SegmentedOption<LedgerExportScope>[] = [
  { value: 'tous', label: 'Les deux' },
  { value: 'entrees', label: 'Entrées' },
  { value: 'sorties', label: 'Sorties' },
];

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Fenêtre par défaut à chaque changement de granularité — assez de points pour lire une courbe, pas trop pour rester lisible. */
function defaultRangeFor(granularity: LedgerGranularity): { from: string; to: string } {
  const to = todayISO();
  switch (granularity) {
    case 'day':
      return { from: isoDaysAgo(30), to };
    case 'week':
      return { from: isoDaysAgo(84), to };
    case 'year':
      return { from: isoDaysAgo(5 * 365), to };
    case 'month':
    default:
      return { from: isoDaysAgo(365), to };
  }
}

/**
 * Tableau de bord du comptable — affiché à chaque connexion (route index).
 * Solde + totaux en un coup d'œil, courbe d'évolution entrées/sorties
 * filtrable par période, et export Excel. La tuile « Dépenses » renvoie
 * vers le détail des dépenses (`/depenses`).
 */
export default function DashboardPage() {
  const { ledger } = useServices();
  const navigate = useNavigate();

  const [granularity, setGranularity] = useState<LedgerGranularity>('month');
  const [range, setRange] = useState(() => defaultRangeFor('month'));
  const [exportScope, setExportScope] = useState<LedgerExportScope>('tous');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const soldeQuery = useQuery({ queryKey: ['ledger'], queryFn: () => ledger.get() });
  const historyQuery = useQuery({
    queryKey: ['ledger-history', granularity, range.from, range.to],
    queryFn: () => ledger.getHistory(granularity, range.from, range.to),
  });

  function onGranularityChange(next: LedgerGranularity) {
    setGranularity(next);
    setRange(defaultRangeFor(next));
  }

  function onExport() {
    if (!historyQuery.data) return;
    setExportError(null);
    setExporting(true);
    try {
      exportLedgerHistoryToExcel(historyQuery.data, granularity, exportScope);
    } catch {
      setExportError("L'export Excel a échoué. Réessayez.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle="Évolution des entrées et des sorties, solde de l'école, et accès rapide au détail des dépenses."
      />

      <StateView loading={soldeQuery.isLoading} error={soldeQuery.error} onRetry={() => soldeQuery.refetch()}>
        {soldeQuery.data ? (
          <div className={styles.tiles}>
            <StatTile
              label="Solde de l'école"
              value={fmtXOF(soldeQuery.data.solde)}
              tone={soldeQuery.data.solde >= 0 ? 'success' : 'danger'}
            />
            <StatTile label="Total des entrées" value={fmtXOF(soldeQuery.data.totalEncaissements)} tone="success" />
            <StatTile
              label="Total des dépenses"
              value={fmtXOF(soldeQuery.data.totalDepenses)}
              tone="warning"
              onClick={() => navigate('/depenses')}
            />
          </div>
        ) : null}
      </StateView>

      <Card style={{ marginTop: 16 }} padded>
        <div className={styles.filters}>
          <Field label="Granularité">
            <Select
              value={granularity}
              onChange={(e) => onGranularityChange(e.target.value as LedgerGranularity)}
            >
              {(Object.keys(GRANULARITY_LABEL) as LedgerGranularity[]).map((g) => (
                <option key={g} value={g}>
                  {GRANULARITY_LABEL[g]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Du">
            <DateInput
              value={range.from}
              max={range.to}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </Field>
          <Field label="Au">
            <DateInput
              value={range.to}
              min={range.from}
              max={todayISO()}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </Field>

          <div className={styles.exportGroup}>
            <span className={styles.exportLabel}>Exporter</span>
            <Segmented value={exportScope} onChange={(v) => setExportScope(v as LedgerExportScope)} options={SCOPE_OPTIONS} />
            <Button
              variant="secondary"
              size="sm"
              loading={exporting}
              disabled={!historyQuery.data?.points.length}
              onClick={onExport}
            >
              Exporter en Excel
            </Button>
          </div>
        </div>

        {exportError ? (
          <p role="alert" className={styles.exportError}>
            {exportError}
          </p>
        ) : null}

        <div className={styles.chartWrap}>
          <StateView
            loading={historyQuery.isLoading}
            error={historyQuery.error}
            onRetry={() => historyQuery.refetch()}
            empty={historyQuery.data?.points.length === 0}
            emptyLabel="Aucun mouvement enregistré sur cette période."
          >
            {historyQuery.data ? <EvolutionChart points={historyQuery.data.points} /> : null}
          </StateView>
        </div>
      </Card>
    </div>
  );
}
