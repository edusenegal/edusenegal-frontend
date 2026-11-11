import { useMutation, useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, StateView, Table, type Column } from '@/components/ui';
import {
  downloadSignedDocument,
  getMySignedDocuments,
  type MySignedDocument,
  type SignedDocType,
} from '@/api/signatures.api';

const TYPE_LABEL: Record<SignedDocType, string> = {
  BULLETIN: 'Bulletin',
  CERTIFICATE: 'Certificat',
  OFFICIAL: 'Document officiel',
  ATTESTATION: 'Attestation',
  RELEVE_NOTES: 'Relevé de notes',
  PAYSLIP: 'Fiche de paie',
  OTHER: 'Document',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function SignedDocumentsPage() {
  const list = useQuery({ queryKey: ['signed-documents'], queryFn: getMySignedDocuments });

  const downloadMutation = useMutation({
    mutationFn: (doc: MySignedDocument) => {
      const label = TYPE_LABEL[doc.documentType] ?? 'document';
      const base = (doc.serialNumber ?? doc.signatureHash).replace(/[^a-zA-Z0-9_-]/g, '');
      return downloadSignedDocument(doc.signatureHash, `${label.toLowerCase().replace(/\s+/g, '_')}_${base}.pdf`);
    },
  });

  const columns: Column<MySignedDocument>[] = [
    { key: 'type', header: 'Type', render: (d) => <Badge tone="info">{TYPE_LABEL[d.documentType] ?? 'Document'}</Badge> },
    { key: 'signer', header: 'Signé par', render: (d) => d.signerName ?? '—' },
    { key: 'date', header: 'Signé le', render: (d) => fmtDate(d.signedAt) },
    { key: 'serial', header: 'N° de série', render: (d) => <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{d.serialNumber ?? '—'}</span> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (d) => (
        <Button
          variant="primary"
          size="sm"
          loading={downloadMutation.isPending && downloadMutation.variables?.id === d.id}
          onClick={() => downloadMutation.mutate(d)}
        >
          Télécharger
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Mes documents signés" subtitle="Documents officiels signés par la direction à votre nom." />
      <Card>
        <StateView
          loading={list.isLoading}
          error={list.error}
          empty={list.data?.length === 0}
          emptyLabel="Aucun document signé pour le moment."
        >
          <Table columns={columns} rows={list.data ?? []} rowKey={(d) => d.id} />
        </StateView>
      </Card>
    </div>
  );
}
