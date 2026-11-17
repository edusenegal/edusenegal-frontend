import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LoadingOverlay,
  PaymentChannelIcon,
  Segmented,
  Select,
  Sheet,
  StatTile,
  StateView,
  Table,
  Textarea,
} from '@/components/ui';
import type { BadgeTone, Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { pushToast } from '@/services/toast';
import { useAuthStore } from '@/stores/auth.store';
import { fmtXOF } from '@/utils/format';
import { CHANNEL_LABELS } from './pricing';
import type { Cashout, CashoutStatus, PaymentChannel, StaffMember, WalletEntry } from '@/types/domain';
import styles from './TreasuryPage.module.css';

/**
 * Trésorerie SenÉtude Pay — solde unique de l'école (Wave + Orange Money +
 * espèces), historique unifié entrées/sorties, validateurs des sorties
 * d'argent, demandes de cashout et saisie du code OTP reçu par SMS.
 */
const CASHOUT_STATUS: Record<CashoutStatus, { label: string; tone: BadgeTone }> = {
  PENDING_VALIDATION: { label: 'En attente de validation', tone: 'warning' },
  APPROVED: { label: 'Approuvé', tone: 'info' },
  EXECUTED: { label: 'Exécuté', tone: 'success' },
  REJECTED: { label: 'Refusé', tone: 'danger' },
  FAILED: { label: 'Échec', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
};

const ENTRY_STATUS_TONE: Record<string, BadgeTone> = {
  COMPLETED: 'success',
  EXECUTED: 'success',
  VALIDATED: 'success',
  PENDING: 'warning',
  PENDING_VALIDATION: 'warning',
  DRAFT: 'neutral',
  APPROVED: 'info',
  FAILED: 'danger',
  REJECTED: 'danger',
  OVERDUE: 'danger',
  REFUNDED: 'info',
  CANCELLED: 'neutral',
};

const ENTRY_STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Encaissé',
  PENDING: 'En attente',
  FAILED: 'Échoué',
  OVERDUE: 'En retard',
  REFUNDED: 'Remboursé',
  VALIDATED: 'Validée',
  DRAFT: 'Brouillon',
  REJECTED: 'Refusé',
  CANCELLED: 'Annulé',
  PENDING_VALIDATION: 'À valider',
  APPROVED: 'Approuvé',
  EXECUTED: 'Exécuté',
};

const KIND_LABEL: Record<WalletEntry['kind'], string> = {
  STUDENT_PAYMENT: 'Scolarité',
  CASHOUT: 'Cashout',
  EXPENSE: 'Dépense',
};

type DirectionFilter = 'ALL' | 'IN' | 'OUT';

const MOBILE_CHANNELS: PaymentChannel[] = ['wave', 'orange_money'];

export default function TreasuryPage() {
  const { schoolWallet, personnel } = useServices();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.session?.userId ?? '');

  // ── Filtres de l'historique ──
  const [direction, setDirection] = useState<DirectionFilter>('ALL');
  const [channel, setChannel] = useState<PaymentChannel | ''>('');
  const [status, setStatus] = useState('');
  const [histPage, setHistPage] = useState(0);

  const walletQuery = useQuery({
    queryKey: ['school-wallet', direction, channel, status, histPage],
    queryFn: () =>
      schoolWallet.getWallet({
        direction: direction === 'ALL' ? undefined : direction,
        channel: channel || undefined,
        status: status || undefined,
        page: histPage,
        size: 20,
      }),
  });
  const validatorsQuery = useQuery({ queryKey: ['cashout-validators'], queryFn: () => schoolWallet.getValidators() });
  const cashoutsQuery = useQuery({ queryKey: ['cashouts'], queryFn: () => schoolWallet.listCashouts() });
  const staffQuery = useQuery({ queryKey: ['personnel'], queryFn: () => personnel.list() });

  const staffById = useMemo(() => {
    const map = new Map<string, StaffMember>();
    for (const m of staffQuery.data ?? []) map.set(m.id, m);
    return map;
  }, [staffQuery.data]);
  const staffName = (id: string) => {
    const m = staffById.get(id);
    return m ? `${m.prenom} ${m.nom}` : id;
  };

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['school-wallet'] });
    queryClient.invalidateQueries({ queryKey: ['cashouts'] });
  }

  // ── Validateurs ──
  const [validatorIds, setValidatorIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (validatorsQuery.data) setValidatorIds(new Set(validatorsQuery.data.validatorIds));
  }, [validatorsQuery.data]);
  const saveValidators = useMutation({
    mutationFn: () => schoolWallet.saveValidators([...validatorIds]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashout-validators'] });
      pushToast('success', 'Validateurs enregistrés.');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });
  const hasAccountant = [...validatorIds].some((id) => /accountant|comptable/i.test(staffById.get(id)?.role ?? ''));

  // ── Demande de cashout ──
  const [requestOpen, setRequestOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reqChannel, setReqChannel] = useState<PaymentChannel>('wave');
  const [phone, setPhone] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [reason, setReason] = useState('');
  const balance = walletQuery.data?.balanceFcfa ?? 0;
  const amountValue = Number(amount);
  const amountTooHigh = amountValue > balance;

  const requestMutation = useMutation({
    mutationFn: () =>
      schoolWallet.requestCashout({
        amountFcfa: amountValue,
        channel: reqChannel,
        destinationPhone: phone.trim(),
        destinationName: beneficiary.trim() || undefined,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setRequestOpen(false);
      setAmount(''); setPhone(''); setBeneficiary(''); setReason('');
      invalidateAll();
      pushToast('success', 'Demande envoyée — chaque validateur reçoit son code par SMS.');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  // ── Saisie OTP / refus ──
  const [otpTarget, setOtpTarget] = useState<Cashout | null>(null);
  const [otp, setOtp] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const approveMutation = useMutation({
    mutationFn: () => schoolWallet.approveCashout(otpTarget!.id, otp.trim()),
    onSuccess: (c) => {
      setOtpTarget(null); setOtp('');
      invalidateAll();
      pushToast(
        c.status === 'EXECUTED' ? 'success' : c.status === 'FAILED' ? 'error' : 'info',
        c.status === 'EXECUTED'
          ? `Cashout exécuté — ${fmtXOF(c.amountFcfa)} versés via ${CHANNEL_LABELS[c.channel]}.`
          : c.status === 'FAILED'
            ? `Échec du versement : ${c.failureMessage ?? 'erreur opérateur'}`
            : 'Votre validation est enregistrée. En attente des autres validateurs.',
      );
    },
    onError: (e: Error) => pushToast('error', e.message),
  });
  const rejectMutation = useMutation({
    mutationFn: () => schoolWallet.rejectCashout(otpTarget!.id, rejectReason.trim()),
    onSuccess: () => {
      setOtpTarget(null); setRejectReason('');
      invalidateAll();
      pushToast('info', 'Demande refusée.');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });
  const resendMutation = useMutation({
    mutationFn: (id: string) => schoolWallet.resendOtp(id),
    onSuccess: () => pushToast('success', 'Nouveaux codes envoyés par SMS.'),
    onError: (e: Error) => pushToast('error', e.message),
  });

  const busyMessage = requestMutation.isPending
    ? 'Envoi de la demande et des codes SMS…'
    : approveMutation.isPending
      ? 'Vérification du code et exécution du versement…'
      : rejectMutation.isPending
        ? 'Enregistrement du refus…'
        : saveValidators.isPending
          ? 'Enregistrement des validateurs…'
          : null;

  const cashoutColumns: Column<Cashout>[] = [
    { key: 'date', header: 'Date', render: (c) => c.createdAt },
    {
      key: 'channel',
      header: 'Canal',
      render: (c) => (
        <span className={styles.channelCell}>
          <PaymentChannelIcon channel={c.channel} size={24} />
          {CHANNEL_LABELS[c.channel]}
        </span>
      ),
    },
    { key: 'amount', header: 'Montant', align: 'right', render: (c) => fmtXOF(c.amountFcfa) },
    { key: 'to', header: 'Bénéficiaire', render: (c) => `${c.destinationName ?? ''} ${c.destinationPhone}`.trim() },
    { key: 'reason', header: 'Motif', render: (c) => c.reason },
    {
      key: 'approvals',
      header: 'Validations',
      render: (c) => (
        <span className={styles.approvals}>
          {c.approvals.map((a) => (
            <Badge key={a.validatorId} tone={a.decision === 'APPROVED' ? 'success' : a.decision === 'REJECTED' ? 'danger' : 'neutral'}>
              {staffName(a.validatorId)}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (c) => (
        <>
          <Badge tone={CASHOUT_STATUS[c.status].tone}>{CASHOUT_STATUS[c.status].label}</Badge>
          {c.failureMessage ? <div className={styles.failure}>{c.failureMessage}</div> : null}
        </>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => {
        if (c.status !== 'PENDING_VALIDATION') return null;
        const mine = c.approvals.find((a) => a.validatorId === currentUserId);
        return (
          <span className={styles.actions}>
            {mine && !mine.decision ? (
              <Button size="sm" variant="primary" onClick={() => setOtpTarget(c)}>
                Saisir mon code
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => resendMutation.mutate(c.id)}>
              Renvoyer les codes
            </Button>
          </span>
        );
      },
    },
  ];

  const entryColumns: Column<WalletEntry>[] = [
    { key: 'date', header: 'Date', render: (e) => e.date },
    {
      key: 'dir',
      header: 'Sens',
      render: (e) => (
        <Badge tone={e.direction === 'IN' ? 'success' : 'warning'}>{e.direction === 'IN' ? 'Entrée' : 'Sortie'}</Badge>
      ),
    },
    { key: 'kind', header: 'Type', render: (e) => KIND_LABEL[e.kind] },
    {
      key: 'channel',
      header: 'Canal',
      render: (e) => (
        <span className={styles.channelCell}>
          <PaymentChannelIcon channel={e.channel} size={24} />
          {e.channel ? CHANNEL_LABELS[e.channel] : '—'}
        </span>
      ),
    },
    { key: 'label', header: 'Libellé', render: (e) => e.label },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      render: (e) => (
        <span className={e.direction === 'IN' ? styles.amountIn : styles.amountOut}>
          {e.direction === 'IN' ? '+' : '−'} {fmtXOF(e.amountFcfa)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (e) => <Badge tone={ENTRY_STATUS_TONE[e.status] ?? 'neutral'}>{ENTRY_STATUS_LABEL[e.status] ?? e.status}</Badge>,
    },
    {
      key: 'after',
      header: 'Solde après',
      align: 'right',
      render: (e) => (e.balanceAfterFcfa == null ? '—' : fmtXOF(e.balanceAfterFcfa)),
    },
  ];

  const wallet = walletQuery.data;

  return (
    <>
      <PageHeader
        title="Trésorerie"
        subtitle="SenÉtude Pay — solde unique de l'école alimenté par Wave, Orange Money et la caisse ; sorties d'argent validées par code SMS."
        action={
          <Button variant="primary" onClick={() => setRequestOpen(true)} disabled={!wallet}>
            Demander une sortie d'argent
          </Button>
        }
      />

      <div className={styles.tiles}>
        <StatTile label="Solde disponible" value={wallet ? fmtXOF(wallet.balanceFcfa) : '…'} tone="success" />
        <StatTile label="Total encaissé" value={wallet ? fmtXOF(wallet.totalIncomesFcfa) : '…'} />
        <StatTile label="Total sorti" value={wallet ? fmtXOF(wallet.totalExpensesFcfa) : '…'} tone="warning" />
      </div>

      <div className={styles.grid}>
        <Card>
          <CardHeader
            title="Validateurs des sorties d'argent"
            action={
              <Button
                size="sm"
                variant="primary"
                disabled={validatorIds.size === 0}
                onClick={() => saveValidators.mutate()}
              >
                Enregistrer
              </Button>
            }
          />
          <p className={styles.hint}>
            Chaque sortie (cashout ou paiement marchand) exige le code SMS de <strong>tous</strong> les validateurs
            cochés. Le comptable doit en faire partie.
          </p>
          <StateView loading={staffQuery.isLoading} error={staffQuery.error ? 'Personnel indisponible' : null} empty={(staffQuery.data ?? []).length === 0} emptyLabel="Aucun membre du personnel.">
            <div className={styles.validators}>
              {(staffQuery.data ?? []).map((m) => (
                <label key={m.id} className={styles.validator}>
                  <input
                    type="checkbox"
                    checked={validatorIds.has(m.id)}
                    onChange={(ev) =>
                      setValidatorIds((prev) => {
                        const next = new Set(prev);
                        if (ev.target.checked) next.add(m.id);
                        else next.delete(m.id);
                        return next;
                      })
                    }
                  />
                  <span>
                    {m.prenom} {m.nom} <span className={styles.role}>— {m.role}</span>
                  </span>
                </label>
              ))}
            </div>
          </StateView>
          {validatorIds.size > 0 && !hasAccountant ? (
            <p className={styles.warn}>Aucun comptable parmi les validateurs — la règle attend le comptable au minimum.</p>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Sorties d'argent" />
          <StateView
            loading={cashoutsQuery.isLoading}
            error={cashoutsQuery.error ? 'Impossible de charger les sorties.' : null}
            empty={(cashoutsQuery.data ?? []).length === 0}
            emptyLabel="Aucune sortie d'argent pour cette année."
            onRetry={() => cashoutsQuery.refetch()}
          >
            <Table columns={cashoutColumns} rows={cashoutsQuery.data ?? []} rowKey={(c) => c.id} />
          </StateView>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Historique du solde"
          action={
            <div className={styles.filters}>
              <Segmented<DirectionFilter>
                options={[
                  { value: 'ALL', label: 'Tout' },
                  { value: 'IN', label: 'Entrées' },
                  { value: 'OUT', label: 'Sorties' },
                ]}
                value={direction}
                onChange={(v) => { setDirection(v); setHistPage(0); }}
              />
              <Select value={channel} onChange={(e) => { setChannel(e.target.value as PaymentChannel | ''); setHistPage(0); }}>
                <option value="">Tous les canaux</option>
                {(Object.keys(CHANNEL_LABELS) as PaymentChannel[]).map((c) => (
                  <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                ))}
              </Select>
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setHistPage(0); }}>
                <option value="">Tous les statuts</option>
                {Object.entries(ENTRY_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
          }
        />
        <StateView
          loading={walletQuery.isLoading}
          error={walletQuery.error ? 'Impossible de charger la trésorerie.' : null}
          empty={(wallet?.entries ?? []).length === 0}
          emptyLabel="Aucun mouvement pour ces filtres."
          onRetry={() => walletQuery.refetch()}
        >
          <Table columns={entryColumns} rows={wallet?.entries ?? []} rowKey={(e) => `${e.kind}-${e.id}`} />
        </StateView>
        {wallet && wallet.totalPages > 1 ? (
          <div className={styles.pager}>
            <Button
              size="sm"
              variant="secondary"
              disabled={histPage <= 0}
              onClick={() => setHistPage((p) => Math.max(0, p - 1))}
            >
              Précédent
            </Button>
            <span className={styles.pagerLabel}>
              Page {wallet.page + 1} / {wallet.totalPages} · {wallet.totalEntries} mouvements
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={histPage >= wallet.totalPages - 1}
              onClick={() => setHistPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        ) : null}
      </Card>

      {/* ── Demande de cashout ── */}
      <Sheet
        title="Demander une sortie d'argent"
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequestOpen(false)}>Annuler</Button>
            <Button
              variant="primary"
              disabled={!amountValue || amountValue <= 0 || amountTooHigh || !phone.trim() || !reason.trim()}
              onClick={() => requestMutation.mutate()}
            >
              Envoyer la demande
            </Button>
          </>
        }
      >
        <p className={styles.hint}>Solde disponible : <strong>{fmtXOF(balance)}</strong>. Les validateurs recevront chacun un code par SMS.</p>
        <Field label="Montant (FCFA)" required error={amountTooHigh ? 'Montant supérieur au solde disponible.' : undefined}>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex. 150000" />
        </Field>
        <Field label="Canal" required>
          <div className={styles.channelChoice}>
            {MOBILE_CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                className={[styles.channelOption, reqChannel === c ? styles.channelSelected : ''].join(' ')}
                onClick={() => setReqChannel(c)}
              >
                <PaymentChannelIcon channel={c} size={32} />
                <span>{CHANNEL_LABELS[c]}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Numéro du bénéficiaire" required hint="Format international, ex. +221771234567">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221…" />
        </Field>
        <Field label="Nom du bénéficiaire">
          <Input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} />
        </Field>
        <Field label="Motif" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. règlement fournisseur cantine" />
        </Field>
      </Sheet>

      {/* ── Saisie du code OTP ── */}
      <Sheet
        title="Valider la sortie d'argent"
        open={otpTarget !== null}
        onClose={() => setOtpTarget(null)}
        width="sm"
        footer={
          <>
            <Button
              variant="danger"
              disabled={!rejectReason.trim()}
              onClick={() => rejectMutation.mutate()}
            >
              Refuser
            </Button>
            <Button variant="primary" disabled={otp.trim().length !== 6} onClick={() => approveMutation.mutate()}>
              Valider avec mon code
            </Button>
          </>
        }
      >
        {otpTarget ? (
          <>
            <p className={styles.hint}>
              <strong>{fmtXOF(otpTarget.amountFcfa)}</strong> via {CHANNEL_LABELS[otpTarget.channel]} vers{' '}
              {otpTarget.destinationName ?? ''} {otpTarget.destinationPhone} — {otpTarget.reason}
            </p>
            <Field label="Code reçu par SMS" required hint="6 chiffres, valable 10 minutes">
              <Input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="______"
              />
            </Field>
            <Field label="Ou refuser (motif)">
              <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motif du refus" />
            </Field>
          </>
        ) : null}
      </Sheet>

      <LoadingOverlay open={busyMessage !== null} message={busyMessage ?? ''} />
    </>
  );
}
