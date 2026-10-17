import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Field, Input, Select, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF } from '@/utils/format';
import { CHANNEL_LABELS, TYPE_LABELS, emptyLevelPricingRow, totalFor } from './pricing';
import type { LevelPricing, PaymentChannel, PaymentType } from '@/types/domain';

export default function PaymentConfigPage() {
  const { paymentConfig } = useServices();
  const queryClient = useQueryClient();

  const configQuery = useQuery({ queryKey: ['payment-config'], queryFn: () => paymentConfig.get() });
  const config = configQuery.data;

  const [type, setType] = useState<PaymentType>('inscription_trimestriel');
  const [levelPricings, setLevelPricings] = useState<LevelPricing[]>([]);
  const [installmentAllowed, setInstallmentAllowed] = useState(false);
  const [maxInstallments, setMaxInstallments] = useState(3);
  const [deferredAllowed, setDeferredAllowed] = useState(false);
  const [maxDeferDays, setMaxDeferDays] = useState(30);
  const [alertDaysBefore, setAlertDaysBefore] = useState(3);
  const [enabledChannels, setEnabledChannels] = useState<Set<PaymentChannel>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Le brouillon est reconstruit au premier chargement d'une configuration
  // donnée (gardé stable par son `id`), pas à chaque refetch déclenché par
  // notre propre sauvegarde — sinon la frappe en cours serait écrasée.
  useEffect(() => {
    if (!config) return;
    setType(config.type);
    setLevelPricings(config.levelPricings);
    setInstallmentAllowed(config.installmentAllowed);
    setMaxInstallments(config.maxInstallments);
    setDeferredAllowed(config.deferredAllowed);
    setMaxDeferDays(config.maxDeferDays);
    setAlertDaysBefore(config.alertDaysBefore);
    setEnabledChannels(new Set(config.enabledChannels));
  }, [config?.id]);

  const saveMutation = useMutation({
    mutationFn: () =>
      paymentConfig.save({
        type,
        levelPricings: levelPricings.map((row) => ({ ...row, totalAnnualFcfa: totalFor(row, type) })),
        installmentAllowed,
        maxInstallments,
        deferredAllowed,
        maxDeferDays,
        alertDaysBefore,
        enabledChannels: [...enabledChannels],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-config'] });
      setSuccess('Configuration des paiements enregistrée.');
      setError(null);
    },
  });

  function updateRow(index: number, patch: Partial<LevelPricing>) {
    setLevelPricings((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    setLevelPricings((rows) => rows.filter((_, i) => i !== index));
  }

  function toggleChannel(channel: PaymentChannel) {
    setEnabledChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  }

  function onSubmit() {
    setSuccess(null);
    if (levelPricings.length === 0) {
      setError('Ajoutez au moins un niveau tarifé.');
      return;
    }
    if (levelPricings.some((r) => !r.level.trim())) {
      setError('Chaque ligne doit préciser un niveau.');
      return;
    }
    if (enabledChannels.size === 0) {
      setError('Activez au moins un canal de paiement.');
      return;
    }
    setError(null);
    saveMutation.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Paiements"
        subtitle={
          config
            ? `Configuration des frais de scolarité — dernière mise à jour le ${config.updatedAt}.`
            : 'Aucune configuration des paiements enregistrée pour le moment.'
        }
      />

      <StateView loading={configQuery.isLoading} error={configQuery.error}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card padded>
            <CardHeader title="Mode de facturation" />
            <div style={{ maxWidth: 360, marginTop: 12 }}>
              <Field label="Type de paiement">
                <Select value={type} onChange={(e) => setType(e.target.value as PaymentType)}>
                  {(Object.keys(TYPE_LABELS) as PaymentType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card padded>
            <CardHeader title="Tarifs par niveau" />
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '4px 0 16px' }}>
              Le total annuel se recalcule automatiquement : inscription + (frais de période × nombre de périodes du
              mode choisi).
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  <th style={{ padding: '6px 8px 6px 0' }}>Niveau</th>
                  <th style={{ padding: '6px 8px' }}>Série</th>
                  <th style={{ padding: '6px 8px' }}>Inscription</th>
                  <th style={{ padding: '6px 8px' }}>Par période</th>
                  <th style={{ padding: '6px 8px' }}>Total annuel</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {levelPricings.map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 8px 8px 0' }}>
                      <Input value={row.level} onChange={(e) => updateRow(i, { level: e.target.value })} style={{ width: 120 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <Input
                        value={row.series ?? ''}
                        onChange={(e) => updateRow(i, { series: e.target.value || null })}
                        placeholder="—"
                        style={{ width: 80 }}
                      />
                    </td>
                    <td style={{ padding: 8 }}>
                      <Input
                        type="number"
                        min={0}
                        value={row.inscriptionFcfa}
                        onChange={(e) => updateRow(i, { inscriptionFcfa: Math.max(0, Number(e.target.value) || 0) })}
                        style={{ width: 110 }}
                      />
                    </td>
                    <td style={{ padding: 8 }}>
                      <Input
                        type="number"
                        min={0}
                        value={row.periodFcfa}
                        onChange={(e) => updateRow(i, { periodFcfa: Math.max(0, Number(e.target.value) || 0) })}
                        style={{ width: 110 }}
                      />
                    </td>
                    <td style={{ padding: 8, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtXOF(totalFor(row, type))}</td>
                    <td style={{ padding: 8 }}>
                      <Button variant="ghost" size="sm" onClick={() => removeRow(i)}>
                        ✕
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button variant="secondary" size="sm" onClick={() => setLevelPricings((rows) => [...rows, emptyLevelPricingRow()])} style={{ marginTop: 12 }}>
              + Ajouter un niveau
            </Button>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <Card padded>
              <CardHeader title="Options avancées" />
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={installmentAllowed} onChange={(e) => setInstallmentAllowed(e.target.checked)} />
                  Paiement en plusieurs fois autorisé
                </label>
                {installmentAllowed ? (
                  <Field label="Nombre maximum d'échéances">
                    <Input
                      type="number"
                      min={2}
                      max={12}
                      value={maxInstallments}
                      onChange={(e) => setMaxInstallments(Math.max(2, Number(e.target.value) || 2))}
                      style={{ width: 100 }}
                    />
                  </Field>
                ) : null}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={deferredAllowed} onChange={(e) => setDeferredAllowed(e.target.checked)} />
                  Report de paiement autorisé
                </label>
                {deferredAllowed ? (
                  <Field label="Délai de report maximum (jours)">
                    <Input
                      type="number"
                      min={1}
                      value={maxDeferDays}
                      onChange={(e) => setMaxDeferDays(Math.max(1, Number(e.target.value) || 1))}
                      style={{ width: 100 }}
                    />
                  </Field>
                ) : null}
                <Field label="Alerte de retard — jours avant l'échéance">
                  <Input
                    type="number"
                    min={0}
                    value={alertDaysBefore}
                    onChange={(e) => setAlertDaysBefore(Math.max(0, Number(e.target.value) || 0))}
                    style={{ width: 100 }}
                  />
                </Field>
              </div>
            </Card>

            <Card padded>
              <CardHeader title="Canaux de paiement acceptés" />
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(Object.keys(CHANNEL_LABELS) as PaymentChannel[]).map((channel) => (
                  <label key={channel} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={enabledChannels.has(channel)} onChange={() => toggleChannel(channel)} />
                    {CHANNEL_LABELS[channel]}
                  </label>
                ))}
              </div>
            </Card>
          </div>

          {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
          {success ? <p style={{ color: 'var(--color-success)', fontSize: 13 }}>{success}</p> : null}
          <div>
            <Button variant="primary" loading={saveMutation.isPending} onClick={onSubmit}>
              Enregistrer la configuration
            </Button>
          </div>
        </div>
      </StateView>
    </div>
  );
}
