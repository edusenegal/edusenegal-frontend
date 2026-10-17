import { Badge, Card, CardHeader } from '@/components/ui';
import { fmtXOF } from '@/utils/format';
import { TYPE_LABELS, totalFor } from '@/features/payments/pricing';
import type { ClassLevel } from '@/types/domain';
import type { ClassDraftRow, PaymentDraft, SubjectDraftRow } from './types';

const LEVELS: ClassLevel[] = ['Seconde', 'Première', 'Terminale'];

interface ConfirmationStepProps {
  label: string;
  dateDebut: string;
  dateFin: string;
  classRows: ClassDraftRow[];
  subjectRows: SubjectDraftRow[];
  payment: PaymentDraft;
}

/** Récapitulatif avant envoi — dernière étape de l'assistant. */
export function ConfirmationStep({ label, dateDebut, dateFin, classRows, subjectRows, payment }: ConfirmationStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card padded>
        <CardHeader title={`${label || 'Nouvelle année'} — ${dateDebut} → ${dateFin}`} />
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Vérifiez les trois étapes ci-dessous avant d'ouvrir l'année. L'année actuellement ouverte sera clôturée
          automatiquement.
        </p>
      </Card>

      <Card padded>
        <CardHeader title="Classes" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {LEVELS.map((level) => {
            const count = classRows.filter((r) => r.level === level).length;
            return (
              <div key={level} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{level}</span>
                <Badge tone={count > 0 ? 'success' : 'neutral'}>{count} classe{count > 1 ? 's' : ''}</Badge>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padded>
        <CardHeader title="Matières & coefficients" />
        <p style={{ fontSize: 13, marginTop: 8 }}>{subjectRows.length} matière{subjectRows.length > 1 ? 's' : ''} configurée{subjectRows.length > 1 ? 's' : ''}.</p>
      </Card>

      <Card padded>
        <CardHeader title="Paiements" />
        <div style={{ fontSize: 13, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>Mode : <strong>{TYPE_LABELS[payment.type]}</strong></div>
          {payment.type === 'bourse' ? (
            <p style={{ color: 'var(--color-text-muted)' }}>Scolarité prise en charge par une bourse — aucun tarif.</p>
          ) : (
            payment.levelPricings.map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                <span>{row.level}</span>
                <span>{fmtXOF(totalFor(row, payment.type))} / an</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
