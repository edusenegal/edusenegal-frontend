import { Button, Card, CardHeader, Input } from '@/components/ui';
import { levelSeriesDisplay, levelSeriesKey, LYCEE_LEVEL_SERIES } from './catalog';
import type { ClassDraftRow, SubjectDraftRow } from './types';

interface SubjectsStepProps {
  classRows: ClassDraftRow[];
  rows: SubjectDraftRow[];
  onRows(rows: SubjectDraftRow[]): void;
}

/**
 * Étape « Matières & coefficients » — fidèle à l'étape Matières de
 * l'assistant de référence : une grille dense matière × (niveau, série),
 * un coefficient par cellule, « Actif : X/N niveaux » par matière.
 *
 * Les colonnes ne couvrent que les couples (niveau, série) réellement
 * présents à l'étape « Classes » (`classRows`) — comme `syncSubjectsWithClasses()`
 * dans le fichier de référence : pas de colonne pour une série qu'aucune
 * classe ne couvre.
 */
export function SubjectsStep({ classRows, rows, onRows }: SubjectsStepProps) {
  const activeColumns = LYCEE_LEVEL_SERIES.filter((ls) =>
    classRows.some((c) => c.level === ls.level && c.series === ls.series),
  );

  function updateRow(key: string, patch: Partial<SubjectDraftRow>) {
    onRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    onRows(rows.filter((r) => r.key !== key));
  }
  function setCoef(key: string, colKey: string, valeur: number) {
    onRows(
      rows.map((r) =>
        r.key === key ? { ...r, coefs: { ...r.coefs, [colKey]: { valeur, enseignee: valeur > 0 } } } : r,
      ),
    );
  }
  function addRow() {
    const coefs: SubjectDraftRow['coefs'] = {};
    for (const ls of activeColumns) coefs[levelSeriesKey(ls.level, ls.series)] = { valeur: 0, enseignee: false };
    onRows([
      ...rows,
      { key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, code: '', nom: '', optionnelle: false, existing: false, coefs },
    ]);
  }

  return (
    <Card padded>
      <CardHeader title="Matières & coefficients" />
      {activeColumns.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 8 }}>
          Ajoutez au moins une classe à l'étape précédente pour configurer des coefficients.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12.5, minWidth: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '6px 10px 6px 0', position: 'sticky', left: 0, background: 'var(--color-surface)' }}>Matière</th>
                {activeColumns.map((ls) => (
                  <th key={levelSeriesKey(ls.level, ls.series)} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                    {levelSeriesDisplay(ls.level, ls.series)}
                  </th>
                ))}
                <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>Actif</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const activeCount = activeColumns.filter((ls) => (row.coefs[levelSeriesKey(ls.level, ls.series)]?.valeur ?? 0) > 0).length;
                return (
                  <tr key={row.key} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 10px 8px 0', position: 'sticky', left: 0, background: 'var(--color-surface)' }}>
                      {row.existing ? (
                        <div>
                          <strong>{row.code}</strong>
                          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{row.nom}</div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Input
                            value={row.code}
                            onChange={(e) => updateRow(row.key, { code: e.target.value.toUpperCase() })}
                            placeholder="Code"
                            style={{ width: 70 }}
                          />
                          <Input
                            value={row.nom}
                            onChange={(e) => updateRow(row.key, { nom: e.target.value })}
                            placeholder="Nom"
                            style={{ width: 150 }}
                          />
                        </div>
                      )}
                    </td>
                    {activeColumns.map((ls) => {
                      const colKey = levelSeriesKey(ls.level, ls.series);
                      const value = row.coefs[colKey]?.valeur ?? 0;
                      return (
                        <td key={colKey} style={{ padding: 8 }}>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            value={value}
                            onChange={(e) => setCoef(row.key, colKey, Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                            style={{ width: 56, textAlign: 'center' }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ padding: 8, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {activeCount}/{activeColumns.length}
                    </td>
                    <td style={{ padding: 8 }}>
                      {!row.existing ? (
                        <Button variant="ghost" size="sm" onClick={() => removeRow(row.key)}>
                          ✕
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Button variant="secondary" size="sm" onClick={addRow} style={{ marginTop: 12 }}>
        + Ajouter une matière
      </Button>
    </Card>
  );
}
