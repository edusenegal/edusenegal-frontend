import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF } from '@/utils/format';
import type { SalarySlip } from '@/types/domain';

export default function PayslipsPage() {
  const { payslips } = useServices();
  const list = useQuery({ queryKey: ['payslips', 'mine'], queryFn: () => payslips.mine() });

  const columns: Column<SalarySlip>[] = [
    { key: 'periode', header: 'Période', render: (p) => p.periode },
    { key: 'montant', header: 'Montant brut', render: (p) => fmtXOF(p.montantBrut) },
    {
      key: 'detail',
      header: 'Détail',
      render: (p) =>
        p.salaryMode === 'par_jour'
          ? `${p.joursTravailles ?? 0} j. travaillé(s)`
          : p.salaryMode === 'par_heure'
            ? `${p.heuresTravaillees ?? 0} h. travaillée(s)`
            : 'Salaire fixe',
    },
    { key: 'date', header: 'Généré le', render: (p) => p.dateGeneration },
  ];

  return (
    <div>
      <PageHeader title="Ma fiche de paie" subtitle="Historique de vos bulletins de salaire." />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(p) => p.id} />
        </StateView>
      </Card>
    </div>
  );
}
