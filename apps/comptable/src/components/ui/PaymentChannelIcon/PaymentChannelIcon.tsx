import type { PaymentChannel } from '@/types/domain';
import styles from './PaymentChannelIcon.module.css';

/**
 * Logo officiel de l'opérateur pour Wave / Orange Money (servi depuis
 * `/public/payment/`), pictogramme neutre pour les autres canaux.
 * Les PNG sont remplaçables à l'identique par ceux des kits presse.
 */
const LOGOS: Partial<Record<PaymentChannel, { src: string; alt: string }>> = {
  wave: { src: '/payment/wave.png', alt: 'Wave' },
  orange_money: { src: '/payment/orange_money.png', alt: 'Orange Money' },
};

const FALLBACK: Record<PaymentChannel, string> = {
  wave: 'W',
  orange_money: 'OM',
  especes: '₣',
  cheque: '✓',
  virement_bancaire: '⇄',
};

export function PaymentChannelIcon({ channel, size = 28 }: { channel: PaymentChannel | null; size?: number }) {
  if (!channel) {
    return <span className={styles.fallback} style={{ width: size, height: size }} aria-hidden>—</span>;
  }
  const logo = LOGOS[channel];
  if (logo) {
    return <img className={styles.logo} src={logo.src} alt={logo.alt} width={size} height={size} />;
  }
  return (
    <span className={styles.fallback} style={{ width: size, height: size }} aria-hidden>
      {FALLBACK[channel]}
    </span>
  );
}
