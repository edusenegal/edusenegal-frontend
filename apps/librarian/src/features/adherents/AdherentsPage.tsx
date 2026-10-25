import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Input, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { isoToFR } from '@/utils/format';
import { BORROWER_TYPE_LABEL, type Borrower, type Loan } from '@/types/domain';

const LOAN_STATUS_LABEL = { en_cours: 'En cours', en_retard: 'En retard', rendu: 'Rendu', perdu: 'Perdu' } as const;
const LOAN_STATUS_TONE = { en_cours: 'success', en_retard: 'danger', rendu: 'neutral', perdu: 'danger' } as const;

export default function AdherentsPage() {
  const { library } = useServices();
  const [search, setSearch] = useState('');
  const listQuery = useQuery({ queryKey: ['borrowers', search], queryFn: () => library.listBorrowers(search) });

  const [selected, setSelected] = useState<Borrower | null>(null);
  const historyQuery = useQuery({
    queryKey: ['borrower-history', selected?.id ?? ''],
    queryFn: () => library.borrowerHistory(selected?.id ?? ''),
    enabled: selected !== null,
  });

  const columns: Column<Borrower>[] = [
    { key: 'nom', header: 'Nom', render: (b) => b.nom },
    { key: 'type', header: 'Type', render: (b) => BORROWER_TYPE_LABEL[b.type] },
    { key: 'encours', header: 'Emprunts en cours', align: 'right', render: (b) => String(b.empruntsEnCours) },
    { key: 'total', header: 'Total emprunts', align: 'right', render: (b) => String(b.totalEmprunts) },
    {
      key: 'actions',
      header: '',
      render: (b) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => setSelected(b)}>
            Historique
          </Button>
        </div>
      ),
    },
  ];

  const historyColumns: Column<Loan>[] = [
    { key: 'oeuvre', header: 'Œuvre', render: (l) => l.workTitre },
    { key: 'emprunt', header: 'Emprunté le', render: (l) => isoToFR(l.dateEmprunt) },
    { key: 'retour', header: 'Retour', render: (l) => (l.dateRetourEffective ? isoToFR(l.dateRetourEffective) : isoToFR(l.dateRetourPrevue)) },
    { key: 'statut', header: 'Statut', render: (l) => <Badge tone={LOAN_STATUS_TONE[l.statut]}>{LOAN_STATUS_LABEL[l.statut]}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Adhérents" subtitle="Élèves, enseignants et personnel inscrits à la bibliothèque." />

      <Card padded style={{ marginBottom: 16 }}>
        <Field label="Rechercher un adhérent">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom…" />
        </Field>
      </Card>

      <StateView
        loading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => listQuery.refetch()}
        empty={listQuery.data?.length === 0}
        emptyLabel="Aucun adhérent."
      >
        <Table columns={columns} rows={listQuery.data ?? []} rowKey={(b) => b.id} />
      </StateView>

      <Sheet title={selected ? `Historique — ${selected.nom}` : 'Historique'} open={selected !== null} onClose={() => setSelected(null)}>
        <StateView loading={historyQuery.isLoading} error={historyQuery.error} empty={historyQuery.data?.length === 0} emptyLabel="Aucun emprunt.">
          <Table columns={historyColumns} rows={historyQuery.data ?? []} rowKey={(l) => l.id} />
        </StateView>
      </Sheet>
    </div>
  );
}
