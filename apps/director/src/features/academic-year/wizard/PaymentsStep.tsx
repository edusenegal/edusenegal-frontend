import { Card, CardHeader, Field, Input } from '@/components/ui';
import {
  CHANNEL_LABELS,
  TYPE_DESCRIPTIONS,
  TYPE_LABELS,
  hasInscriptionComponent,
  hasPeriodComponent,
  periodColumnLabel,
  totalFor,
} from '@/features/payments/pricing';
import { fmtXOF } from '@/utils/format';
import type { ClassLevel, PaymentChannel, PaymentType } from '@/types/domain';
import type { ClassDraftRow, PaymentDraft } from './types';

const LEVELS: ClassLevel[] = ['Seconde', 'Première', 'Terminale'];

interface PaymentsStepProps {
  classRows: ClassDraftRow[];
  draft: PaymentDraft;
  onDraft(draft: PaymentDraft): void;
}

/** Petit interrupteur à bascule — reprend le composant `.toggle`/`.knob` de l'assistant de référence. */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange(v: boolean): void }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      style={{
        width: 42,
        height: 22,
        borderRadius: 11,
        cursor: 'pointer',
        flexShrink: 0,
        background: checked ? 'var(--color-success)' : 'var(--color-border-strong)',
        position: 'relative',
        transition: 'background .2s',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          transition: 'left .2s',
        }}
      />
    </div>
  );
}

/**
 * Étape « Paiements » — portée à l'identique de l'étape Paiements de
 * l'assistant d'onboarding de référence (`10_onboarding_v2_updated.html`),
 * dynamique de la même façon :
 *
 * - Le mode de facturation se choisit sur des cartes (pas un menu
 *   déroulant), chacune avec son libellé et sa description, comme les
 *   `.pay-opt` de référence.
 * - Le tableau de tarifs n'affiche jamais une ligne par classe : une seule
 *   ligne par NIVEAU (Seconde/Première/Terminale), partagée par toutes les
 *   séries et tags de ce niveau — exactement ce que l'assistant de
 *   référence fait avec `uniqueLevels`.
 * - Les colonnes du tableau sont dynamiques selon le mode choisi : la
 *   colonne « Inscription » n'apparaît que si le mode en comporte une, la
 *   colonne de périodicité change de libellé (« Mensuel », « Trimestriel »,
 *   « Annuel ») et disparaît pour « Inscription seule » ; le mode
 *   « Boursier » (frais pris en charge) n'affiche aucune colonne de tarif.
 * - Échelonnement, report et canaux de paiement se basculent avec des
 *   interrupteurs à bascule, comme dans la référence.
 *
 * Différence volontaire : la référence ne propose que 7 modes et 2 canaux
 * (Wave, Orange Money) codés en dur. Cette application en a 8 (le mode
 * « Boursier ») et 5 canaux (+ Espèces, Chèque, Virement bancaire), tous
 * réellement supportés par le backend (payment-service) — on ne retire pas
 * une capacité réelle pour coller pixel pour pixel à la référence, qui
 * n'était qu'une démo. Idem pour le nombre maximum d'échéances / jours de
 * report et l'alerte de retard, éditables ici (champs réels de
 * payment-service) alors que la référence ne faisait qu'afficher ces
 * nombres en texte, sans les rendre modifiables.
 */
export function PaymentsStep({ classRows, draft, onDraft }: PaymentsStepProps) {
  function patch(p: Partial<PaymentDraft>) {
    onDraft({ ...draft, ...p });
  }
  function updateLevel(level: ClassLevel, p: Partial<Pick<(typeof draft.levelPricings)[number], 'inscriptionFcfa' | 'periodFcfa'>>) {
    patch({ levelPricings: draft.levelPricings.map((r) => (r.level === level ? { ...r, ...p } : r)) });
  }
  function toggleChannel(channel: PaymentChannel) {
    const set = new Set(draft.enabledChannels);
    if (set.has(channel)) set.delete(channel);
    else set.add(channel);
    patch({ enabledChannels: [...set] });
  }

  const activeLevels = LEVELS.filter((lvl) => classRows.some((c) => c.level === lvl));
  const showInscription = hasInscriptionComponent(draft.type);
  const showPeriod = hasPeriodComponent(draft.type);
  const periodLabel = periodColumnLabel(draft.type);
  const isBourse = draft.type === 'bourse';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card padded>
        <CardHeader title="Mode de facturation" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {(Object.keys(TYPE_LABELS) as PaymentType[]).map((t) => {
            const selected = draft.type === t;
            return (
              <div
                key={t}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => patch({ type: t })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    patch({ type: t });
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: `2px solid ${selected ? 'var(--color-success-border)' : 'var(--color-border)'}`,
                  background: selected ? 'var(--color-success-bg)' : 'var(--color-surface)',
                  transition: 'border-color .2s, background .2s',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: `2.5px solid ${selected ? 'var(--color-success)' : 'var(--color-border-strong)'}`,
                    background: selected ? 'var(--color-success)' : 'transparent',
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{TYPE_LABELS[t]}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{TYPE_DESCRIPTIONS[t]}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padded>
        <CardHeader title="Tarifs par niveau" />
        {isBourse ? (
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Scolarité prise en charge par une bourse — aucun tarif à saisir pour ce mode.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '4px 0 12px' }}>
              Un seul tarif par niveau : toutes les séries et divisions de ce niveau le partagent. Les colonnes
              changent selon le mode choisi ci-dessus.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  <th style={{ padding: '6px 8px 6px 0' }}>Niveau</th>
                  {showInscription ? <th style={{ padding: '6px 8px' }}>Inscription (FCFA)</th> : null}
                  {showPeriod ? <th style={{ padding: '6px 8px' }}>{periodLabel} (FCFA)</th> : null}
                  <th style={{ padding: '6px 8px' }}>Total annuel</th>
                </tr>
              </thead>
              <tbody>
                {activeLevels.map((level) => {
                  const row = draft.levelPricings.find((r) => r.level === level);
                  const inscriptionFcfa = row?.inscriptionFcfa ?? 0;
                  const periodFcfa = row?.periodFcfa ?? 0;
                  return (
                    <tr key={level} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 8px 8px 0', fontWeight: 600 }}>{level}</td>
                      {showInscription ? (
                        <td style={{ padding: 8 }}>
                          <Input
                            type="number"
                            min={0}
                            value={inscriptionFcfa}
                            onChange={(e) => updateLevel(level, { inscriptionFcfa: Math.max(0, Number(e.target.value) || 0) })}
                            style={{ width: 120 }}
                          />
                        </td>
                      ) : null}
                      {showPeriod ? (
                        <td style={{ padding: 8 }}>
                          <Input
                            type="number"
                            min={0}
                            value={periodFcfa}
                            onChange={(e) => updateLevel(level, { periodFcfa: Math.max(0, Number(e.target.value) || 0) })}
                            style={{ width: 120 }}
                          />
                        </td>
                      ) : null}
                      <td style={{ padding: 8, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {fmtXOF(totalFor({ level, series: null, displayName: level, inscriptionFcfa, periodFcfa, totalAnnualFcfa: 0 }, draft.type))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </Card>

      <Card padded>
        <CardHeader title="Options avancées" />
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--color-border-strong)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Autoriser l'échelonnement</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Max {draft.maxInstallments} versements</div>
            </div>
            <ToggleSwitch checked={draft.installmentAllowed} onChange={(v) => patch({ installmentAllowed: v })} />
          </div>
          {draft.installmentAllowed ? (
            <Field label="Nombre maximum d'échéances">
              <Input
                type="number"
                min={2}
                max={12}
                value={draft.maxInstallments}
                onChange={(e) => patch({ maxInstallments: Math.max(2, Number(e.target.value) || 2) })}
                style={{ width: 100 }}
              />
            </Field>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--color-border-strong)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Paiement différé</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Jusqu'à {draft.maxDeferDays} jours</div>
            </div>
            <ToggleSwitch checked={draft.deferredAllowed} onChange={(v) => patch({ deferredAllowed: v })} />
          </div>
          {draft.deferredAllowed ? (
            <Field label="Délai de report maximum (jours)">
              <Input
                type="number"
                min={1}
                value={draft.maxDeferDays}
                onChange={(e) => patch({ maxDeferDays: Math.max(1, Number(e.target.value) || 1) })}
                style={{ width: 100 }}
              />
            </Field>
          ) : null}

          {(Object.keys(CHANNEL_LABELS) as PaymentChannel[]).map((channel) => (
            <div
              key={channel}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--color-border-strong)' }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{CHANNEL_LABELS[channel]}</div>
              <ToggleSwitch checked={draft.enabledChannels.includes(channel)} onChange={() => toggleChannel(channel)} />
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Alerte avant échéance</span>
            <Input
              type="number"
              min={1}
              max={30}
              value={draft.alertDaysBefore}
              onChange={(e) => patch({ alertDaysBefore: Math.max(0, Number(e.target.value) || 0) })}
              style={{ width: 70 }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>jours avant</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
