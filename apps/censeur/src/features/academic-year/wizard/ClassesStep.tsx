import { Button, Card, CardHeader, DateInput, Field, Input, Select } from '@/components/ui';
import type { ClassLevel } from '@/types/domain';
import { LYCEE_SERIES_BY_LEVEL } from './catalog';
import type { ClassDraftRow } from './types';

const LEVELS: ClassLevel[] = ['Seconde', 'Première', 'Terminale'];

function previewName(level: ClassLevel, series: string | null, tag: string | null): string {
  return [level, series, tag].filter(Boolean).join(' ');
}

interface ClassesStepProps {
  label: string;
  onLabel(v: string): void;
  dateDebut: string;
  onDateDebut(v: string): void;
  dateFin: string;
  onDateFin(v: string): void;
  rows: ClassDraftRow[];
  onRows(rows: ClassDraftRow[]): void;
}

/**
 * Étape « Classes » — fidèle à l'étape Classes de l'assistant d'onboarding
 * de référence (`10_onboarding_v2_updated.html`), branche LYCEE uniquement :
 * les niveaux Seconde / Première / Terminale sont fixes, et le choix de
 * série proposé pour chacun vient du catalogue (`catalog.ts`), lui-même
 * porté de la branche LYCEE du fichier de référence.
 *
 * Préremplie avec les classes réelles actuelles de l'établissement
 * (`existing: true`) plutôt que repartie des valeurs par défaut de
 * l'onboarding — il s'agit d'ouvrir une année suivante pour une école qui
 * existe déjà, pas d'onboarder une nouvelle école.
 */
export function ClassesStep({ label, onLabel, dateDebut, onDateDebut, dateFin, onDateFin, rows, onRows }: ClassesStepProps) {
  function updateRow(key: string, patch: Partial<ClassDraftRow>) {
    onRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    onRows(rows.filter((r) => r.key !== key));
  }
  function addRow(level: ClassLevel) {
    const series = LYCEE_SERIES_BY_LEVEL[level][0] ?? null;
    onRows([
      ...rows,
      { key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, level, series, tag: null, capacite: 40, existing: false },
    ]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card padded>
        <CardHeader title="Nouvelle année scolaire" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
          <Field label="Libellé" required>
            <Input value={label} onChange={(e) => onLabel(e.target.value)} placeholder="Ex. 2027-2028" />
          </Field>
          <Field label="Date de début" required>
            <DateInput value={dateDebut} onChange={(e) => onDateDebut(e.target.value)} />
          </Field>
          <Field label="Date de fin" required>
            <DateInput value={dateFin} onChange={(e) => onDateFin(e.target.value)} />
          </Field>
        </div>
      </Card>

      {LEVELS.map((level) => {
        const levelRows = rows.filter((r) => r.level === level);
        const seriesOptions = LYCEE_SERIES_BY_LEVEL[level].filter((s): s is string => Boolean(s));
        return (
          <Card key={level} padded>
            <CardHeader title={level} />
            {levelRows.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '8px 0' }}>Aucune classe pour ce niveau.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                    <th style={{ padding: '6px 8px 6px 0' }}>Série</th>
                    <th style={{ padding: '6px 8px' }}>Division / tag</th>
                    <th style={{ padding: '6px 8px' }}>Capacité</th>
                    <th style={{ padding: '6px 8px' }}>Nom</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {levelRows.map((row) => (
                    <tr key={row.key} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 8px 8px 0' }}>
                        <Select
                          value={row.series ?? ''}
                          onChange={(e) => updateRow(row.key, { series: e.target.value || null })}
                          style={{ width: 120 }}
                        >
                          <option value="">— Aucune —</option>
                          {seriesOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td style={{ padding: 8 }}>
                        <Input
                          value={row.tag ?? ''}
                          onChange={(e) => updateRow(row.key, { tag: e.target.value || null })}
                          placeholder="A, B…"
                          style={{ width: 90 }}
                        />
                      </td>
                      <td style={{ padding: 8 }}>
                        <Input
                          type="number"
                          min={1}
                          value={row.capacite}
                          onChange={(e) => updateRow(row.key, { capacite: Math.max(1, Number(e.target.value) || 1) })}
                          style={{ width: 90 }}
                        />
                      </td>
                      <td style={{ padding: 8, color: 'var(--color-text-muted)' }}>{previewName(row.level, row.series, row.tag)}</td>
                      <td style={{ padding: 8 }}>
                        <Button variant="ghost" size="sm" onClick={() => removeRow(row.key)}>
                          ✕
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Button variant="secondary" size="sm" onClick={() => addRow(level)} style={{ marginTop: 12 }}>
              + Ajouter une classe en {level}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
