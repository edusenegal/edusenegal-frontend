import { useState } from 'react';
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
import type { Cashout, CashoutStatus, PaymentChannel, School, WalletEntry } from '@/types/domain';
import styles from './TreasuryPage.module.css';

/**
 * Trésorerie SenÉtude Pay (espace comptable) — solde unique de l'école,
 * historique unifié, demande de cashout et saisie du code OTP reçu par SMS.
 * La désignation des validateurs reste au directeur.
 */
const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  especes: 'Espèces',
  cheque: 'Chèque',
  virement_bancaire: 'Virement bancaire',
};

const CASHOUT_STATUS: Record<CashoutStatus, { label: string; tone: BadgeTone }> = {
  PENDING_VALIDATION: { label: 'En attente de validation', tone: 'warning' },
  APPROVED: { label: 'Approuvé', tone: 'info' },
  EXECUTED: { label: 'Exécuté', tone: 'success' },
  REJECTED: { label: 'Refusé', tone: 'danger' },
  FAILED: { label: 'Échec', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
};

const ENTRY_STATUS_TONE: Record<string, BadgeTone> = {
  COMPLETED: 'success', EXECUTED: 'success', VALIDATED: 'success',
  PENDING: 'warning', PENDING_VALIDATION: 'warning', DRAFT: 'neutral', APPROVED: 'info',
  FAILED: 'danger', REJECTED: 'danger', OVERDUE: 'danger', REFUNDED: 'info', CANCELLED: 'neutral',
};
const ENTRY_STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Encaissé', PENDING: 'En attente', FAILED: 'Échoué', OVERDUE: 'En retard', REFUNDED: 'Remboursé',
  VALIDATED: 'Validée', DRAFT: 'Brouillon', REJECTED: 'Refusé', CANCELLED: 'Annulé',
  PENDING_VALIDATION: 'À valider', APPROVED: 'Approuvé', EXECUTED: 'Exécuté',
};
const KIND_LABEL: Record<WalletEntry['kind'], string> = { STUDENT_PAYMENT: 'Scolarité', CASHOUT: 'Cashout', EXPENSE: 'Dépense' };

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** Libellé lisible même si le backend renvoie encore un identifiant brut (avant redeploy). */
function displayLabel(e: WalletEntry): string {
  const raw = (e.label ?? '').trim();
  if (raw && !OBJECT_ID.test(raw)) return raw;
  if (e.kind === 'STUDENT_PAYMENT') return 'Scolarité';
  if (e.kind === 'CASHOUT') return "Sortie d'argent";
  return 'Dépense';
}

function esc(v: string): string {
  return v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/**
 * Reçu imprimable d'un mouvement — ouvert dans une fenêtre dédiée qui lance
 * l'impression (« Enregistrer en PDF »). En-tête école + logo, filigrane du
 * logo (ou sigle), année scolaire, couleur de marque. Aucune dépendance PDF.
 */
function openReceipt(
  e: WalletEntry,
  opts: { schoolName: string; logoUrl: string | null; brandColor: string; yearLabel: string; channelLabel: string },
): void {
  const { schoolName, logoUrl, brandColor, yearLabel, channelLabel } = opts;
  const isIn = e.direction === 'IN';
  const title =
    e.kind === 'STUDENT_PAYMENT' ? 'REÇU DE PAIEMENT' : e.kind === 'CASHOUT' ? 'JUSTIFICATIF DE SORTIE' : 'JUSTIFICATIF DE DÉPENSE';
  const rows: Array<[string, string]> = [
    ['Date', e.date || '—'],
    ['Type', displayLabel(e)],
    ['Canal', channelLabel],
    ['Référence', e.reference || '—'],
    ['Statut', e.status || '—'],
    ['Solde après', e.balanceAfterFcfa == null ? '—' : fmtXOF(e.balanceAfterFcfa)],
  ];
  const watermark = logoUrl
    ? `<img class="wm" src="${esc(logoUrl)}" alt="" />`
    : `<div class="wm wm-text">${esc(schoolName)}</div>`;
  const logoHead = logoUrl ? `<img class="logo" src="${esc(logoUrl)}" alt="" />` : '';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" /><title>Reçu ${esc(e.id)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#111;margin:0;padding:40px}
  .sheet{position:relative;max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:16px;padding:36px 40px;overflow:hidden}
  .wm{position:absolute;top:50%;left:50%;width:360px;transform:translate(-50%,-50%);opacity:.06;pointer-events:none}
  .wm-text{font-size:54px;font-weight:800;color:${brandColor};white-space:nowrap}
  header{display:flex;align-items:center;gap:16px;border-bottom:3px solid ${brandColor};padding-bottom:18px;position:relative}
  .logo{width:54px;height:54px;object-fit:contain;border-radius:10px}
  .school{font-size:20px;font-weight:800}
  .year{color:#6b7280;font-size:13px;margin-top:2px}
  h1{font-size:15px;letter-spacing:.14em;color:${brandColor};margin:26px 0 18px;position:relative}
  table{width:100%;border-collapse:collapse;position:relative}
  td{padding:10px 0;font-size:14px;border-bottom:1px solid #f1f5f9}
  td.k{color:#6b7280}td.v{text-align:right;font-weight:600}
  .amount{margin-top:22px;display:flex;justify-content:space-between;align-items:baseline;position:relative}
  .amount .big{font-size:30px;font-weight:800;color:${isIn ? '#15803d' : '#b45309'}}
  footer{margin-top:30px;text-align:center;color:#9ca3af;font-size:12px;position:relative}
  @media print{body{padding:0}.sheet{border:none}}
</style></head>
<body><div class="sheet">${watermark}
  <header>${logoHead}<div><div class="school">${esc(schoolName)}</div><div class="year">Année scolaire ${esc(yearLabel)}</div></div></header>
  <h1>${title}</h1>
  <table>${rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('')}</table>
  <div class="amount"><span>Montant</span><span class="big">${isIn ? '+' : '−'} ${esc(fmtXOF(e.amountFcfa))}</span></div>
  <footer>Reçu généré via SenÉtude Pay · ${esc(e.id)}</footer>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};window.onafterprint=function(){window.close();};</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

type DirectionFilter = 'ALL' | 'IN' | 'OUT';
const MOBILE_CHANNELS: PaymentChannel[] = ['wave', 'orange_money'];

export default function TreasuryPage() {
  const { schoolWallet, school } = useServices();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.session?.userId ?? '');

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
  const cashoutsQuery = useQuery({ queryKey: ['cashouts'], queryFn: () => schoolWallet.listCashouts() });
  const schoolQuery = useQuery<School>({ queryKey: ['school'], queryFn: () => school.getSchool() });
  const yearLabelQuery = useQuery({ queryKey: ['active-year-label'], queryFn: () => school.getActiveYearLabel() });

  const [detail, setDetail] = useState<WalletEntry | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['school-wallet'] });
    queryClient.invalidateQueries({ queryKey: ['cashouts'] });
  }

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
    onSuccess: () => { setOtpTarget(null); setRejectReason(''); invalidateAll(); pushToast('info', 'Demande refusée.'); },
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
        : null;

  const cashoutColumns: Column<Cashout>[] = [
    { key: 'date', header: 'Date', render: (c) => c.createdAt },
    { key: 'channel', header: 'Canal', render: (c) => (<span className={styles.channelCell}><PaymentChannelIcon channel={c.channel} size={24} />{CHANNEL_LABELS[c.channel]}</span>) },
    { key: 'amount', header: 'Montant', align: 'right', render: (c) => fmtXOF(c.amountFcfa) },
    { key: 'to', header: 'Bénéficiaire', render: (c) => `${c.destinationName ?? ''} ${c.destinationPhone}`.trim() },
    { key: 'reason', header: 'Motif', render: (c) => c.reason },
    {
      key: 'approvals', header: 'Validations',
      render: (c) => `${c.approvals.filter((a) => a.decision === 'APPROVED').length} / ${c.approvals.length}`,
    },
    {
      key: 'status', header: 'Statut',
      render: (c) => (<><Badge tone={CASHOUT_STATUS[c.status].tone}>{CASHOUT_STATUS[c.status].label}</Badge>{c.failureMessage ? <div className={styles.failure}>{c.failureMessage}</div> : null}</>),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (c) => {
        if (c.status !== 'PENDING_VALIDATION') return null;
        const mine = c.approvals.find((a) => a.validatorId === currentUserId);
        return (
          <span className={styles.actions}>
            {mine && !mine.decision ? (<Button size="sm" variant="primary" onClick={() => setOtpTarget(c)}>Saisir mon code</Button>) : null}
            <Button size="sm" variant="ghost" onClick={() => resendMutation.mutate(c.id)}>Renvoyer les codes</Button>
          </span>
        );
      },
    },
  ];

  const entryColumns: Column<WalletEntry>[] = [
    { key: 'date', header: 'Date', render: (e) => e.date },
    { key: 'dir', header: 'Sens', render: (e) => (<Badge tone={e.direction === 'IN' ? 'success' : 'warning'}>{e.direction === 'IN' ? 'Entrée' : 'Sortie'}</Badge>) },
    { key: 'kind', header: 'Type', render: (e) => KIND_LABEL[e.kind] },
    { key: 'channel', header: 'Canal', render: (e) => (<span className={styles.channelCell}><PaymentChannelIcon channel={e.channel} size={24} />{e.channel ? CHANNEL_LABELS[e.channel] : '—'}</span>) },
    { key: 'label', header: 'Libellé', render: (e) => displayLabel(e) },
    { key: 'amount', header: 'Montant', align: 'right', render: (e) => (<span className={e.direction === 'IN' ? styles.amountIn : styles.amountOut}>{e.direction === 'IN' ? '+' : '−'} {fmtXOF(e.amountFcfa)}</span>) },
    { key: 'status', header: 'Statut', render: (e) => <Badge tone={ENTRY_STATUS_TONE[e.status] ?? 'neutral'}>{ENTRY_STATUS_LABEL[e.status] ?? e.status}</Badge> },
    { key: 'after', header: 'Solde après', align: 'right', render: (e) => (e.balanceAfterFcfa == null ? '—' : fmtXOF(e.balanceAfterFcfa)) },
  ];

  const wallet = walletQuery.data;

  return (
    <>
      <PageHeader
        title="Trésorerie"
        subtitle="SenÉtude Pay — solde unique de l'école (Wave, Orange Money, caisse) et sorties d'argent validées par code SMS."
        action={<Button variant="primary" onClick={() => setRequestOpen(true)} disabled={!wallet}>Demander une sortie d'argent</Button>}
      />

      <div className={styles.tiles}>
        <StatTile label="Solde disponible" value={wallet ? fmtXOF(wallet.balanceFcfa) : '…'} tone="success" />
        <StatTile label="Total encaissé" value={wallet ? fmtXOF(wallet.totalIncomesFcfa) : '…'} />
        <StatTile label="Total sorti" value={wallet ? fmtXOF(wallet.totalExpensesFcfa) : '…'} tone="warning" />
      </div>

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

      <div style={{ height: 16 }} />

      <Card>
        <CardHeader
          title="Historique du solde"
          action={
            <div className={styles.filters}>
              <Segmented<DirectionFilter>
                options={[{ value: 'ALL', label: 'Tout' }, { value: 'IN', label: 'Entrées' }, { value: 'OUT', label: 'Sorties' }]}
                value={direction}
                onChange={(v) => { setDirection(v); setHistPage(0); }}
              />
              <Select value={channel} onChange={(e) => { setChannel(e.target.value as PaymentChannel | ''); setHistPage(0); }}>
                <option value="">Tous les canaux</option>
                {(Object.keys(CHANNEL_LABELS) as PaymentChannel[]).map((c) => (<option key={c} value={c}>{CHANNEL_LABELS[c]}</option>))}
              </Select>
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setHistPage(0); }}>
                <option value="">Tous les statuts</option>
                {Object.entries(ENTRY_STATUS_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
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
          <Table columns={entryColumns} rows={wallet?.entries ?? []} rowKey={(e) => `${e.kind}-${e.id}`} onRowClick={(e) => setDetail(e)} />
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

      <Sheet
        title="Demander une sortie d'argent"
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequestOpen(false)}>Annuler</Button>
            <Button variant="primary" disabled={!amountValue || amountValue <= 0 || amountTooHigh || !phone.trim() || !reason.trim()} onClick={() => requestMutation.mutate()}>
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
              <button key={c} type="button" className={[styles.channelOption, reqChannel === c ? styles.channelSelected : ''].join(' ')} onClick={() => setReqChannel(c)}>
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

      <Sheet
        title="Valider la sortie d'argent"
        open={otpTarget !== null}
        onClose={() => setOtpTarget(null)}
        width="sm"
        footer={
          <>
            <Button variant="danger" disabled={!rejectReason.trim()} onClick={() => rejectMutation.mutate()}>Refuser</Button>
            <Button variant="primary" disabled={otp.trim().length !== 6} onClick={() => approveMutation.mutate()}>Valider avec mon code</Button>
          </>
        }
      >
        {otpTarget ? (
          <>
            <p className={styles.hint}>
              <strong>{fmtXOF(otpTarget.amountFcfa)}</strong> via {CHANNEL_LABELS[otpTarget.channel]} vers {otpTarget.destinationName ?? ''} {otpTarget.destinationPhone} — {otpTarget.reason}
            </p>
            <Field label="Code reçu par SMS" required hint="6 chiffres, valable 10 minutes">
              <Input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="______" />
            </Field>
            <Field label="Ou refuser (motif)">
              <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motif du refus" />
            </Field>
          </>
        ) : null}
      </Sheet>

      <Sheet
        title="Détail du mouvement"
        open={detail !== null}
        onClose={() => setDetail(null)}
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetail(null)}>Fermer</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!detail) return;
                openReceipt(detail, {
                  schoolName: schoolQuery.data?.name ?? 'EduSénégal',
                  logoUrl: schoolQuery.data?.logoUrl ?? null,
                  brandColor: schoolQuery.data?.brandColor ?? '#1D9E75',
                  yearLabel: yearLabelQuery.data ?? '',
                  channelLabel: detail.channel ? CHANNEL_LABELS[detail.channel] : '—',
                });
              }}
            >
              Télécharger le reçu
            </Button>
          </>
        }
      >
        {detail ? (
          <dl className={styles.detail}>
            <div><dt>Date</dt><dd>{detail.date || '—'}</dd></div>
            <div><dt>Sens</dt><dd>{detail.direction === 'IN' ? 'Entrée' : 'Sortie'}</dd></div>
            <div><dt>Type</dt><dd>{KIND_LABEL[detail.kind]}</dd></div>
            <div>
              <dt>Canal</dt>
              <dd><span className={styles.channelCell}><PaymentChannelIcon channel={detail.channel} size={22} />{detail.channel ? CHANNEL_LABELS[detail.channel] : '—'}</span></dd>
            </div>
            <div><dt>Libellé</dt><dd>{displayLabel(detail)}</dd></div>
            <div><dt>Référence</dt><dd>{detail.reference || '—'}</dd></div>
            <div><dt>Montant</dt><dd className={detail.direction === 'IN' ? styles.amountIn : styles.amountOut}>{detail.direction === 'IN' ? '+' : '−'} {fmtXOF(detail.amountFcfa)}</dd></div>
            <div><dt>Statut</dt><dd><Badge tone={ENTRY_STATUS_TONE[detail.status] ?? 'neutral'}>{ENTRY_STATUS_LABEL[detail.status] ?? detail.status}</Badge></dd></div>
            <div><dt>Solde avant</dt><dd>{detail.balanceBeforeFcfa == null ? '—' : fmtXOF(detail.balanceBeforeFcfa)}</dd></div>
            <div><dt>Solde après</dt><dd>{detail.balanceAfterFcfa == null ? '—' : fmtXOF(detail.balanceAfterFcfa)}</dd></div>
          </dl>
        ) : null}
      </Sheet>

      <LoadingOverlay open={busyMessage !== null} message={busyMessage ?? ''} />
    </>
  );
}
