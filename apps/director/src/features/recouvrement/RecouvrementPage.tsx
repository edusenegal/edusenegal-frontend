import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, Meter, StateView, StatTile, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF } from '@/utils/format';

interface ClassRow {
  classId: string;
  className: string;
  level: string;
  totalStudents: number;
  expected: number;
  collected: number;
  rate: number;
}

interface LevelRow {
  level: string;
  totalStudents: number;
  expected: number;
  collected: number;
  rate: number;
}

function rateTone(rate: number): 'success' | 'warning' | 'danger' {
  return rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger';
}

export default function RecouvrementPage() {
  const { classes, students, paymentConfig } = useServices();
  const navigate = useNavigate();

  // Un seul chargement : pour chaque classe, on résout le roster puis sa
  // synthèse de recouvrement (dû NET de bourse côté serveur), et on agrège
  // par niveau et pour toute l'école.
  const query = useQuery({
    queryKey: ['recouvrement'],
    queryFn: async (): Promise<ClassRow[]> => {
      const classList = await classes.list();
      const rows = await Promise.all(
        classList.map(async (c): Promise<ClassRow> => {
          const roster = await students.list(c.id);
          const ids = roster.map((s) => s.id);
          const stats = ids.length > 0 ? await paymentConfig.getClassStats(ids, c.id) : null;
          return {
            classId: c.id,
            className: c.name,
            level: c.level,
            totalStudents: roster.length,
            expected: stats?.totalExpectedFcfa ?? 0,
            collected: stats?.totalCollectedFcfa ?? 0,
            rate: stats?.collectionRate ?? 0,
          };
        }),
      );
      return rows;
    },
  });

  const rows = query.data ?? [];

  const school = useMemo(() => {
    const expected = rows.reduce((a, r) => a + r.expected, 0);
    const collected = rows.reduce((a, r) => a + r.collected, 0);
    const totalStudents = rows.reduce((a, r) => a + r.totalStudents, 0);
    return {
      expected,
      collected,
      totalStudents,
      rate: expected > 0 ? Math.round((collected / expected) * 1000) / 10 : 0,
    };
  }, [rows]);

  const byLevel = useMemo<LevelRow[]>(() => {
    const map = new Map<string, LevelRow>();
    for (const r of rows) {
      const cur = map.get(r.level) ?? { level: r.level, totalStudents: 0, expected: 0, collected: 0, rate: 0 };
      cur.totalStudents += r.totalStudents;
      cur.expected += r.expected;
      cur.collected += r.collected;
      map.set(r.level, cur);
    }
    return [...map.values()].map((l) => ({
      ...l,
      rate: l.expected > 0 ? Math.round((l.collected / l.expected) * 1000) / 10 : 0,
    }));
  }, [rows]);

  const levelColumns: Column<LevelRow>[] = [
    { key: 'niveau', header: 'Niveau', render: (l) => l.level },
    { key: 'eleves', header: 'Élèves', align: 'right', render: (l) => String(l.totalStudents) },
    { key: 'du', header: 'Dû (net bourse)', align: 'right', render: (l) => fmtXOF(l.expected) },
    { key: 'encaisse', header: 'Encaissé', align: 'right', render: (l) => fmtXOF(l.collected) },
    {
      key: 'taux',
      header: 'Taux',
      render: (l) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
          <Meter value={l.rate} tone={rateTone(l.rate)} />
          <span style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{l.rate}%</span>
        </div>
      ),
    },
  ];

  const classColumns: Column<ClassRow>[] = [
    { key: 'classe', header: 'Classe', render: (c) => c.className },
    { key: 'niveau', header: 'Niveau', render: (c) => c.level },
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

  return (
    <div>
      <PageHeader
        title="Recouvrement"
        subtitle="Progression des paiements — par élève, classe, niveau et pour toute l’école. Le dû est net de bourse."
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
          <CardHeader title="Par niveau" />
          <Table columns={levelColumns} rows={byLevel} rowKey={(l) => l.level} />
        </Card>

        <Card padded>
          <CardHeader title="Par classe" />
          <Table
            columns={classColumns}
            rows={rows}
            rowKey={(c) => c.classId}
            onRowClick={(c) => navigate(`/classes/${c.classId}`)}
          />
        </Card>
      </StateView>
    </div>
  );
}
