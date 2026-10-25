import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Input, Select, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { isoToFR } from '@/utils/format';
import { BORROWER_TYPE_LABEL, type BorrowerType, type Loan } from '@/types/domain';

const STATUS_TONE = { en_cours: 'success', en_retard: 'danger', rendu: 'neutral', perdu: 'danger' } as const;
const STATUS_LABEL = { en_cours: 'En cours', en_retard: 'En retard', rendu: 'Rendu', perdu: 'Perdu' } as const;

export default function EmpruntsPage() {
  const { library } = useServices();
  const queryClient = useQueryClient();

  const loansQuery = useQuery({ queryKey: ['loans', 'en_cours'], queryFn: () => library.listLoans('en_cours') });

  const [barcode, setBarcode] = useState('');
  const [emprunteurNom, setEmprunteurNom] = useState('');
  const [emprunteurType, setEmprunteurType] = useState<BorrowerType>('eleve');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const lendMutation = useMutation({
    mutationFn: () => library.lend({ barcode: barcode.trim(), emprunteurNom: emprunteurNom.trim(), emprunteurType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['library-stats'] });
      setBarcode('');
      setEmprunteurNom('');
      setError(null);
      setOk(true);
    },
    onError: (err: unknown) => {
      setOk(false);
      setError(err instanceof AppError ? err.message : "L'emprunt a échoué.");
    },
  });

  function onLend(e: FormEvent) {
    e.preventDefault();
    if (!barcode.trim() || !emprunteurNom.trim()) {
      setError('Code-barres et nom de l’emprunteur sont obligatoires.');
      return;
    }
    setOk(false);
    lendMutation.mutate();
  }

  const invalidateLoans = () => {
    queryClient.invalidateQueries({ queryKey: ['loans'] });
    queryClient.invalidateQueries({ queryKey: ['library-stats'] });
  };
  const returnMutation = useMutation({ mutationFn: (id: string) => library.returnLoan(id), onSuccess: invalidateLoans });
  const renewMutation = useMutation({ mutationFn: (id: string) => library.renewLoan(id), onSuccess: invalidateLoans });
  const lostMutation = useMutation({ mutationFn: (id: string) => library.declareLost(id), onSuccess: invalidateLoans });

  const columns: Column<Loan>[] = [
    { key: 'oeuvre', header: 'Œuvre', render: (l) => l.workTitre },
    { key: 'code', header: 'Code-barres', render: (l) => l.copyBarcode },
    { key: 'emprunteur', header: 'Emprunteur', render: (l) => `${l.emprunteurNom} (${BORROWER_TYPE_LABEL[l.emprunteurType]})` },
    { key: 'prevu', header: 'Retour prévu', render: (l) => isoToFR(l.dateRetourPrevue) },
    { key: 'statut', header: 'Statut', render: (l) => <Badge tone={STATUS_TONE[l.statut]}>{STATUS_LABEL[l.statut]}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (l) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => returnMutation.mutate(l.id)}>
            Retour
          </Button>
          <Button variant="ghost" size="sm" onClick={() => renewMutation.mutate(l.id)}>
            Renouveler
          </Button>
          <Button variant="ghost" size="sm" onClick={() => lostMutation.mutate(l.id)}>
            Perdu
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Emprunts" subtitle="Enregistrez un prêt et gérez les emprunts en cours." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Nouvel emprunt" />
        <form onSubmit={onLend} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Code-barres de l'exemplaire" required>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="W1-001" style={{ width: 180 }} />
          </Field>
          <Field label="Nom de l'emprunteur" required>
            <Input value={emprunteurNom} onChange={(e) => setEmprunteurNom(e.target.value)} style={{ width: 220 }} />
          </Field>
          <Field label="Type">
            <Select value={emprunteurType} onChange={(e) => setEmprunteurType(e.target.value as BorrowerType)}>
              <option value="eleve">Élève</option>
              <option value="enseignant">Enseignant</option>
              <option value="personnel">Personnel</option>
            </Select>
          </Field>
          <Button type="submit" variant="primary" loading={lendMutation.isPending}>
            Enregistrer l'emprunt
          </Button>
        </form>
        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{error}</p> : null}
        {ok ? <p style={{ color: 'var(--color-success)', fontSize: 13, marginTop: 8 }}>Emprunt enregistré.</p> : null}
      </Card>

      <StateView
        loading={loansQuery.isLoading}
        error={loansQuery.error}
        onRetry={() => loansQuery.refetch()}
        empty={loansQuery.data?.length === 0}
        emptyLabel="Aucun emprunt en cours."
      >
        <Table columns={columns} rows={loansQuery.data ?? []} rowKey={(l) => l.id} />
      </StateView>
    </div>
  );
}
