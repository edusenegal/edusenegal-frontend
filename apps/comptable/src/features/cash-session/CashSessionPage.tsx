import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DateInput,
  Field,
  Input,
  Sheet,
  StateView,
  StatTile,
  Table,
  Textarea,
  type Column,
} from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { sessionContext } from '@/api/client';
import { fmtXOF, isoToFR, todayISO } from '@/utils/format';
import type { CashSession, PaymentChannel } from '@/types/domain';

const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  especes: 'Espèces',
  cheque: 'Chèque',
  virement_bancaire: 'Virement bancaire',
};

function firstDayOfMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function CashSessionPage() {
  const { cashSessions } = useServices();
  const queryClient = useQueryClient();
  const { userId } = sessionContext();

  const [closeOpen, setCloseOpen] = useState(false);
  const [physicalCount, setPhysicalCount] = useState('');
  const [gapJustification, setGapJustification] = useState('');
  const [closeError, setCloseError] = useState<string | null>(null);
  const [lastClosed, setLastClosed] = useState<CashSession | null>(null);

  const [historyFrom, setHistoryFrom] = useState(firstDayOfMonthISO());
  const [historyTo, setHistoryTo] = useState(todayISO());

  const current = useQuery({ queryKey: ['cash-session', 'current'], queryFn: () => cashSessions.getCurrent() });
  const history = useQuery({
    queryKey: ['cash-session', 'history', historyFrom, historyTo],
    queryFn: () => cashSessions.getHistory(isoToFR(historyFrom), isoToFR(historyTo)),
  });

  function invalidateCurrent() {
    queryClient.invalidateQueries({ queryKey: ['cash-session', 'current'] });
    queryClient.invalidateQueries({ queryKey: ['cash-session', 'history'] });
  }

  const openMutation = useMutation({
    mutationFn: () => cashSessions.open(),
    onSuccess: invalidateCurrent,
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      cashSessions.close(Number(physicalCount), gapJustification.trim() || undefined),
    onSuccess: (closed) => {
      setLastClosed(closed);
      setCloseOpen(false);
      setPhysicalCount('');
      setGapJustification('');
      setCloseError(null);
      invalidateCurrent();
    },
    onError: (err: unknown) => {
      // L'écart n'est connu qu'une fois le comptage soumis — le backend
      // renvoie une erreur de validation (422) tant que la justification
      // manque, plutôt que de la deviner à l'avance côté écran.
      setCloseError(err instanceof AppError ? err.message : 'Clôture impossible.');
    },
  });

  const session = current.data ?? null;

  const historyColumns: Column<CashSession>[] = useMemo(
    () => [
      { key: 'date', header: 'Date', render: (r) => r.dateSession },
      {
        key: 'cashier',
        header: 'Comptable',
        render: (r) => (r.cashierId === userId ? 'Vous' : `#${r.cashierId.slice(-6)}`),
      },
      {
        key: 'statut',
        header: 'Statut',
        render: (r) => (
          <Badge tone={r.statut === 'ouverte' ? 'info' : 'success'}>
            {r.statut === 'ouverte' ? 'Ouverte' : 'Clôturée'}
          </Badge>
        ),
      },
      {
        key: 'encaissements',
        header: 'Encaissements',
        align: 'right',
        render: (r) => (r.totalEncaissements != null ? fmtXOF(r.totalEncaissements) : '—'),
      },
      {
        key: 'depenses',
        header: 'Dépenses',
        align: 'right',
        render: (r) => (r.totalDepenses != null ? fmtXOF(r.totalDepenses) : '—'),
      },
      {
        key: 'comptage',
        header: 'Comptage physique',
        align: 'right',
        render: (r) => (r.comptagePhysique != null ? fmtXOF(r.comptagePhysique) : '—'),
      },
      {
        key: 'ecart',
        header: 'Écart',
        align: 'right',
        render: (r) =>
          r.ecart != null ? (
            <span style={{ color: r.ecart === 0 ? 'var(--color-text-muted)' : 'var(--color-danger)' }}>
              {fmtXOF(r.ecart)}
            </span>
          ) : (
            '—'
          ),
      },
    ],
    [userId],
  );

  return (
    <div>
      <PageHeader
        title="Caisse"
        subtitle="Ouverture et clôture de la session de caisse du jour — l'écart entre le solde théorique et le comptage physique doit être justifié avant de clôturer."
      />

      <StateView loading={current.isLoading} error={current.error} onRetry={() => current.refetch()}>
        {session ? (
          <Card padded>
            <CardHeader
              title={
                <>
                  Session du {session.dateSession} <Badge tone="info">Ouverte</Badge>
                </>
              }
              action={
                <Button variant="primary" onClick={() => setCloseOpen(true)}>
                  Clôturer la caisse
                </Button>
              }
            />
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              Ouverte à {session.ouvertureLe}. Les totaux du jour sont calculés au moment de la clôture.
            </p>
          </Card>
        ) : (
          <Card padded>
            <CardHeader title="Aucune session de caisse ouverte aujourd'hui" />
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 12px' }}>
              Ouvrez la session pour pouvoir enregistrer et clôturer les mouvements de caisse du jour.
            </p>
            <Button variant="primary" loading={openMutation.isPending} onClick={() => openMutation.mutate()}>
              Ouvrir la caisse
            </Button>
            {openMutation.error ? (
              <p style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 8 }}>
                {openMutation.error instanceof AppError ? openMutation.error.message : "Ouverture impossible."}
              </p>
            ) : null}
          </Card>
        )}
      </StateView>

      {lastClosed ? (
        <Card padded style={{ marginTop: 12 }}>
          <CardHeader title={`Reçu de clôture — ${lastClosed.dateSession}`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 8 }}>
            <StatTile label="Encaissements" value={fmtXOF(lastClosed.totalEncaissements ?? 0)} tone="success" />
            <StatTile label="Dépenses" value={fmtXOF(lastClosed.totalDepenses ?? 0)} tone="warning" />
            <StatTile label="Comptage physique" value={fmtXOF(lastClosed.comptagePhysique ?? 0)} />
            <StatTile
              label="Écart"
              value={fmtXOF(lastClosed.ecart ?? 0)}
              tone={(lastClosed.ecart ?? 0) === 0 ? 'success' : 'danger'}
            />
          </div>
          {lastClosed.encaissementsParCanal.length > 0 ? (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 4px' }}>Par canal</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {lastClosed.encaissementsParCanal.map((line) => (
                  <li key={line.canal}>
                    {CHANNEL_LABEL[line.canal]} — {fmtXOF(line.montantFcfa)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {lastClosed.justificationEcart ? (
            <p style={{ fontSize: 13, marginTop: 8 }}>
              Justification de l'écart : « {lastClosed.justificationEcart} »
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ marginTop: 16 }}>
        <CardHeader
          title="Historique des sessions"
          action={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <DateInput value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
              <span style={{ color: 'var(--color-text-muted)' }}>→</span>
              <DateInput value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
            </div>
          }
        />
        <StateView
          loading={history.isLoading}
          error={history.error}
          empty={(history.data ?? []).length === 0}
          emptyLabel="Aucune session sur cette période."
          onRetry={() => history.refetch()}
        >
          <Table columns={historyColumns} rows={history.data ?? []} rowKey={(r) => r.id} />
        </StateView>
      </Card>

      <Sheet
        title="Clôturer la caisse"
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              loading={closeMutation.isPending}
              disabled={!physicalCount}
              onClick={() => closeMutation.mutate()}
            >
              Clôturer
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Field label="Montant physiquement compté (FCFA)" required>
            <Input
              type="number"
              min={0}
              value={physicalCount}
              onChange={(e) => setPhysicalCount(e.target.value)}
            />
          </Field>
          <Field
            label="Justification de l'écart"
            hint="Obligatoire uniquement si le comptage diffère du solde théorique calculé par le serveur."
          >
            <Textarea value={gapJustification} onChange={(e) => setGapJustification(e.target.value)} rows={3} />
          </Field>
          {closeError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{closeError}</p> : null}
        </div>
      </Sheet>
    </div>
  );
}
