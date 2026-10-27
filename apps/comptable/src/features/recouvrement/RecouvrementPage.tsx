import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, CardHeader, Field, Input, Meter, StateView, StatTile, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF } from '@/utils/format';

interface Row {
  studentId: string;
  nom: string;
  classe: string;
  expected: number;
  collected: number;
  rate: number;
  status: string;
}
interface ClassRollup {
  classe: string;
  totalStudents: number;
  expected: number;
  collected: number;
  rate: number;
}

function rateTone(rate: number): 'success' | 'warning' | 'danger' {
  return rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger';
}

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Soldé',
  PARTIAL: 'Partiel',
  PENDING: 'En attente',
  OVERDUE: 'En retard',
  NONE: '—',
};
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'success',
  PARTIAL: 'warning',
  PENDING: 'neutral',
  OVERDUE: 'danger',
  NONE: 'neutral',
};

export default function RecouvrementPage() {
  const { students, payments } = useServices();
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['recouvrement-compta'],
    queryFn: async (): Promise<Row[]> => {
      const all = await students.listAll();
      const byId = new Map(all.map((s) => [s.id, s]));
      const collection = await payments.getCollection(all.map((s) => s.id));
      return collection.byStudent.map((r) => ({
        studentId: r.studentId,
        nom: byId.get(r.studentId)?.nom ?? r.studentId,
        classe: byId.get(r.studentId)?.classe ?? '—',
        expected: r.expectedFcfa,
        collected: r.collectedFcfa,
        rate: r.collectionRate,
        status: r.status,
      }));
    },
  });

  const rows = query.data ?? [];

  const school = useMemo(() => {
    const expected = rows.reduce((a, r) => a + r.expected, 0);
    const collected = rows.reduce((a, r) => a + r.collected, 0);
    return {
      expected,
      collected,
      totalStudents: rows.length,
      rate: expected > 0 ? Math.round((collected / expected) * 1000) / 10 : 0,
    };
  }, [rows]);

  const byClass = useMemo<ClassRollup[]>(() => {
    const map = new Map<string, ClassRollup>();
    for (const r of rows) {
      const cur = map.get(r.classe) ?? { classe: r.classe, totalStudents: 0, expected: 0, collected: 0, rate: 0 };
      cur.totalStudents += 1;
      cur.expected += r.expected;
      cur.collected += r.collected;
      map.set(r.classe, cur);
    }
    return [...map.values()]
      .map((c) => ({ ...c, rate: c.expected > 0 ? Math.round((c.collected / c.expected) * 1000) / 10 : 0 }))
      .sort((a, b) => a.classe.localeCompare(b.classe));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => `${r.nom} ${r.classe}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const classColumns: Column<ClassRollup>[] = [
    { key: 'classe', header: 'Classe', render: (c) => c.classe },
    { key: 'eleves', header: 'Élèves', align: 'right', render: (c) => String(c.totalStudents) },
    { key: 'du', header: 'Dû (net bourse)', align: 'right', render: (c) => fmtXOF(c.expected) },
    { key: 'encaisse', header: 'Encaissé', align: 'right', render: (c) => fmtXOF(c.collected) },
    {
      key: 'taux',
      header: 'Taux',
      render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
          <Meter value={c.rate} tone={rateTone(c.rate)} />
          <span style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{c.rate}%</span>
        </div>
      ),
    },
  ];

  const studentColumns: Column<Row>[] = [
    { key: 'nom', header: 'Élève', render: (r) => r.nom },
    { key: 'classe', header: 'Classe', render: (r) => r.classe },
    { key: 'du', header: 'Dû (net bourse)', align: 'right', render: (r) => fmtXOF(r.expected) },
    { key: 'encaisse', header: 'Encaissé', align: 'right', render: (r) => fmtXOF(r.collected) },
    { key: 'taux', header: 'Taux', align: 'right', render: (r) => `${r.rate}%` },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{STATUS_LABEL[r.status] ?? r.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Recouvrement"
        subtitle="Progression des paiements par élève et par classe. Le dû est net de bourse."
      />

      <StateView loading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
          <StatTile label="Taux de recouvrement" value={`${school.rate}%`} tone={rateTone(school.rate)} />
          <StatTile label="Dû (net de bourse)" value={fmtXOF(school.expected)} />
          <StatTile label="Encaissé" value={fmtXOF(school.collected)} tone="success" />
          <StatTile label="Reste à recouvrer" value={fmtXOF(Math.max(0, school.expected - school.collected))} tone={school.expected - school.collected > 0 ? 'warning' : 'success'} />
          <StatTile label="Élèves" value={String(school.totalStudents)} />
        </div>

        <Card padded style={{ marginBottom: 16 }}>
          <CardHeader title="Par classe" />
          <Table columns={classColumns} rows={byClass} rowKey={(c) => c.classe} />
        </Card>

        <Card padded>
          <CardHeader title="Par élève" />
          <Field label="Rechercher">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou classe…" />
          </Field>
          <div style={{ marginTop: 10 }}>
            <Table columns={studentColumns} rows={filtered} rowKey={(r) => r.studentId} />
          </div>
        </Card>
      </StateView>
    </div>
  );
}
