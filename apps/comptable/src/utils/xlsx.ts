import * as XLSX from 'xlsx';

/**
 * Export générique vers un classeur Excel (.xlsx). Les colonnes sont déduites
 * des clés de la première ligne ; chaque ligne est un objet `{ en-tête: valeur }`.
 * Utilisé par la comptabilité (dépenses, encaissements) pour exporter la vue
 * courante selon les filtres appliqués.
 */
export function exportRowsToXlsx(
  filename: string,
  rows: Array<Record<string, string | number>>,
  sheetName = 'Export',
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
