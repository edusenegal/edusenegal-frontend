import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, CardHeader, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import styles from './TransferDetailPage.module.css';

const STATUS_TONE = { en_attente: 'warning', acceptee: 'success', refusee: 'danger' } as const;
const STATUS_LABEL = { en_attente: 'En attente', acceptee: 'Acceptée', refusee: 'Refusée' } as const;

export default function TransferDetailPage() {
  const { transferId = '' } = useParams();
  const { transfers, classes } = useServices();

  const transferQuery = useQuery({ queryKey: ['transfer', transferId], queryFn: () => transfers.get(transferId) });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const t = transferQuery.data;

  const classNameOf = (classId: string | null) => (classId ? classList.data?.find((c) => c.id === classId)?.name ?? '—' : '—');

  return (
    <div>
      <Link to="/transferts" className={styles.back}>
        ← Transferts
      </Link>
      <PageHeader
        title={t?.studentNom ?? '…'}
        subtitle={t ? `Demande de transfert ${t.mode === 'interne' ? 'interne' : 'externe'} du ${t.date}` : undefined}
      />

      <StateView loading={transferQuery.isLoading} error={transferQuery.error}>
        {t ? (
          <Card>
            <CardHeader title="Détails de la demande" />
            <div className={styles.rows}>
              <div className={styles.row}>
                <span className={styles.label}>Élève</span>
                <span className={styles.value}>{t.studentNom}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Type</span>
                <span className={styles.value}>{t.mode === 'interne' ? 'Interne (même établissement)' : 'Externe (autre école)'}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Classe de départ</span>
                <span className={styles.value}>{classNameOf(t.classeDepartId)}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>{t.mode === 'interne' ? 'Classe d’arrivée' : 'École de destination'}</span>
                <span className={styles.value}>
                  {t.mode === 'interne' ? classNameOf(t.classeArriveeId) : `${t.ecoleDestination ?? '—'} (${t.regionDestination ?? '—'})`}
                </span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Date de la demande</span>
                <span className={styles.value}>{t.date}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Statut</span>
                <Badge tone={STATUS_TONE[t.statut]}>{STATUS_LABEL[t.statut]}</Badge>
              </div>
            </div>
          </Card>
        ) : null}
      </StateView>
    </div>
  );
}
