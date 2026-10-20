import * as XLSX from 'xlsx';
import type { LedgerGranularity, LedgerHistory } from '@/types/domain';
import { periodLabelFull } from '@/utils/format';

/** Que garder dans l'export — "trier par entrées et sorties" du cahier des charges. */
export type LedgerExportScope = 'tous' | 'entrees' | 'sorties';

const GRANULARITY_LABEL: Record<LedgerGranularity, string> = {
  day: 'jour',
  week: 'semaine',
  month: 'mois',
  year: 'annee',
};

/**
 * Construit un classeur Excel à partir de l'historique du grand livre et
 * déclenche son téléchargement — une ligne par période (jour/semaine/mois/
 * année selon le filtre choisi à l'écran), colonnes restreintes à `scope`
 * quand le comptable ne veut que les entrées ou que les sorties, plus un
 * onglet résumé avec les totaux de la période.
 */
export function exportLedgerHistoryToExcel(
  history: LedgerHistory,
  granularity: LedgerGranularity,
  scope: LedgerExportScope = 'tous',
): void {
  const rows = history.points.map((point) => {
    const row: Record<string, string | number> = { Période: periodLabelFull(point.period) };
    if (scope !== 'sorties') row['Entrées (FCFA)'] = point.entreesFcfa;
    if (scope !== 'entrees') row['Sorties (FCFA)'] = point.sortiesFcfa;
    if (scope === 'tous') row['Solde de la période (FCFA)'] = point.entreesFcfa - point.sortiesFcfa;
    return row;
  });

  const detailSheet = XLSX.utils.json_to_sheet(rows);
  detailSheet['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 24 }];

  const summarySheet = XLSX.utils.json_to_sheet([
    { Indicateur: 'Granularité', Valeur: GRANULARITY_LABEL[granularity] },
    { Indicateur: 'Total entrées (FCFA)', Valeur: history.totalEntreesFcfa },
    { Indicateur: 'Total sorties (FCFA)', Valeur: history.totalSortiesFcfa },
    { Indicateur: 'Solde', Valeur: history.solde },
  ]);
  summarySheet['!cols'] = [{ wch: 24 }, { wch: 18 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Évolution');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `grand-livre-${GRANULARITY_LABEL[granularity]}-${today}.xlsx`);
}
