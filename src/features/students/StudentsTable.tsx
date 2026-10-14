import { Badge, Meter, Table, type Column } from '@/components/ui';
import type { Student } from '@/types/domain';

interface StudentsTableProps {
  students: Student[];
  showClass?: boolean;
  onRowClick?(student: Student): void;
}

const STATUS_TONE = { actif: 'success', suspendu: 'danger', transfere: 'neutral' } as const;
const STATUS_LABEL = { actif: 'Actif', suspendu: 'Suspendu', transfere: 'Transféré' } as const;

/** Table des élèves — réutilisée par la fiche de classe et l'écran Élèves. */
export function StudentsTable({ students, showClass = false, onRowClick }: StudentsTableProps) {
  const columns: Column<Student>[] = [
    { key: 'nom', header: 'Élève', render: (s) => `${s.prenom} ${s.nom}` },
    ...(showClass ? [{ key: 'classe', header: 'Classe', render: (s: Student) => s.classe } as Column<Student>] : []),
    { key: 'moyenne', header: 'Moyenne', render: (s) => `${s.moyenne.toFixed(1)}/20` },
    { key: 'absences', header: 'Absences', render: (s) => String(s.absences) },
    {
      key: 'paiement',
      header: 'Paiement',
      render: (s) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
          <span>{s.tauxPaiement}%</span>
          <Meter value={s.tauxPaiement} tone={s.tauxPaiement >= 80 ? 'success' : 'danger'} />
        </div>
      ),
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (s) => <Badge tone={STATUS_TONE[s.statut]}>{STATUS_LABEL[s.statut]}</Badge>,
    },
  ];

  return <Table columns={columns} rows={students} rowKey={(s) => s.id} onRowClick={onRowClick} />;
}
