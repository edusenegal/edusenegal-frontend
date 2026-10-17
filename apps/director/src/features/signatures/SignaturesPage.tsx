import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Field, Input, Select, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { BulletinPeriod, SignedDocument } from '@/types/domain';
import { buildDownloadFilename } from '@/utils/format';

/** Nom de fichier lisible à partir du nom affiché ("Prénom Nom") -- voir `SignaturesPort.downloadDocument`. */
function buildSignedFilename(d: SignedDocument): string {
  const [first, ...rest] = d.cible.trim().split(/\s+/);
  return buildDownloadFilename(d.type.toLowerCase(), first ?? '', rest.join(' '));
}

const STUDENT_DOC_TYPES = ['Bulletin', 'Certificat de scolarité', 'Attestation de réussite'];
const STAFF_DOC_TYPES = ['Attestation de travail', 'Certificat de présence', 'Document administratif'];

export default function SignaturesPage() {
  const { signatures, classes, students, teachers } = useServices();
  const queryClient = useQueryClient();

  const documents = useQuery({ queryKey: ['signed-documents'], queryFn: () => signatures.listDocuments() });
  const periods = useQuery({ queryKey: ['bulletin-periods'], queryFn: () => signatures.listBulletinPeriods() });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const teacherList = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list() });

  const [search, setSearch] = useState('');

  // Signature groupée (bulletins d'une classe)
  const [bulkClassId, setBulkClassId] = useState('');
  const [bulkPeriod, setBulkPeriod] = useState<BulletinPeriod['key'] | ''>('');

  // Signature individuelle
  const [mode, setMode] = useState<'eleve' | 'personnel'>('eleve');
  const [indivClassId, setIndivClassId] = useState('');
  const [indivStudentId, setIndivStudentId] = useState('');
  const [indivStaffId, setIndivStaffId] = useState('');
  const [indivType, setIndivType] = useState(STUDENT_DOC_TYPES[0]!);
  const [indivPeriod, setIndivPeriod] = useState<BulletinPeriod['key'] | ''>('');

  const studentsOfIndivClass = useQuery({
    queryKey: ['students', indivClassId],
    queryFn: () => students.list(indivClassId),
    enabled: !!indivClassId,
  });

  const filtered = (documents.data ?? []).filter(
    (d) => !search.trim() || `${d.serie} ${d.type} ${d.cible}`.toLowerCase().includes(search.toLowerCase()),
  );

  const availablePeriods = (periods.data ?? []).filter((p) => p.available);

  const signBulkMutation = useMutation({
    mutationFn: () => signatures.signBulk(bulkClassId, bulkPeriod as BulletinPeriod['key']),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signed-documents'] });
      setBulkClassId('');
      setBulkPeriod('');
    },
  });

  const signIndivMutation = useMutation({
    mutationFn: () =>
      mode === 'eleve'
        ? signatures.signForStudent(indivStudentId, indivType, indivType === 'Bulletin' ? (indivPeriod as BulletinPeriod['key']) : null)
        : signatures.signForStaff(indivStaffId, indivType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signed-documents'] });
      setIndivStudentId('');
      setIndivStaffId('');
    },
  });

  // CORRECTION (bug signalé) : téléchargement d'un document signé — fetch +
  // téléchargement local (comme le bouton "Télécharger" des bulletins non
  // signés), plutôt qu'un lien direct cassé vers `downloadUrl`.
  const downloadMutation = useMutation({
    mutationFn: (d: SignedDocument) => signatures.downloadDocument(d.signatureHash ?? '', buildSignedFilename(d)),
  });

  const docTypes = mode === 'eleve' ? STUDENT_DOC_TYPES : STAFF_DOC_TYPES;

  const columns: Column<SignedDocument>[] = [
    { key: 'serie', header: 'Série', render: (d) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.serie}</span> },
    { key: 'type', header: 'Type', render: (d) => d.type },
    { key: 'cible', header: 'Concerne', render: (d) => d.cible },
    { key: 'date', header: 'Date', render: (d) => d.date },
    { key: 'signataire', header: 'Signataire', render: (d) => d.signataire },
    {
      key: 'download',
      header: '',
      render: (d) =>
        d.signatureHash ? (
          <Button
            variant="ghost"
            size="sm"
            loading={downloadMutation.isPending && downloadMutation.variables === d}
            onClick={() => downloadMutation.mutate(d)}
          >
            Télécharger
          </Button>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Bulletins & signatures" subtitle="Signature électronique des bulletins et des documents administratifs." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <Card padded>
          <CardHeader title="Signature groupée — bulletins d’une classe" />
          <div style={{ marginTop: 16 }}>
            <Field label="Classe">
              <Select value={bulkClassId} onChange={(e) => setBulkClassId(e.target.value)}>
                <option value="">— Choisir une classe —</option>
                {classList.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Période" required hint={availablePeriods.length === 0 ? 'Aucune période disponible pour le moment.' : undefined}>
              <Select id="b-bulk-period" value={bulkPeriod} onChange={(e) => setBulkPeriod(e.target.value as BulletinPeriod['key'])}>
                <option value="">— Choisir une période —</option>
                {(periods.data ?? []).map((p) => (
                  <option key={p.key} value={p.key} disabled={!p.available}>
                    {p.label} {p.available ? '' : '(indisponible)'}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="primary"
              disabled={!bulkClassId || !bulkPeriod}
              loading={signBulkMutation.isPending}
              onClick={() => signBulkMutation.mutate()}
            >
              Signer tous les bulletins de la classe
            </Button>
            {signBulkMutation.isSuccess ? (
              <p style={{ fontSize: 12.5, color: 'var(--color-success)', marginTop: 8 }}>
                {signBulkMutation.data.signed} bulletin(s) signé(s).
              </p>
            ) : null}
            {signBulkMutation.error ? (
              <p style={{ fontSize: 12.5, color: 'var(--color-danger)', marginTop: 8 }}>
                {(signBulkMutation.error as Error).message}
              </p>
            ) : null}
          </div>
        </Card>

        <Card padded>
          <CardHeader title="Signature individuelle" />
          <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
            <Button id="b-dest-eleve" variant={mode === 'eleve' ? 'primary' : 'secondary'} size="sm" onClick={() => { setMode('eleve'); setIndivType(STUDENT_DOC_TYPES[0]!); }}>
              Élève
            </Button>
            <Button id="b-dest-staff" variant={mode === 'personnel' ? 'primary' : 'secondary'} size="sm" onClick={() => { setMode('personnel'); setIndivType(STAFF_DOC_TYPES[0]!); }}>
              Personnel
            </Button>
          </div>

          {mode === 'eleve' ? (
            <>
              <Field label="Classe">
                <Select
                  id="b-classe2"
                  value={indivClassId}
                  onChange={(e) => {
                    setIndivClassId(e.target.value);
                    setIndivStudentId('');
                  }}
                >
                  <option value="">— Choisir une classe —</option>
                  {classList.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Élève">
                <Select id="b-eleve" value={indivStudentId} onChange={(e) => setIndivStudentId(e.target.value)} disabled={!indivClassId}>
                  <option value="">— Choisir un élève —</option>
                  {studentsOfIndivClass.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.prenom} {s.nom}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : (
            <Field label="Membre du personnel">
              <Select id="b-staff" value={indivStaffId} onChange={(e) => setIndivStaffId(e.target.value)}>
                <option value="">— Choisir un membre du personnel —</option>
                {teacherList.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Type de document">
            <Select id="b-type" value={indivType} onChange={(e) => setIndivType(e.target.value)}>
              {docTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          {mode === 'eleve' && indivType === 'Bulletin' ? (
            <Field label="Période" required>
              <Select id="b-period" value={indivPeriod} onChange={(e) => setIndivPeriod(e.target.value as BulletinPeriod['key'])}>
                <option value="">— Choisir une période —</option>
                {(periods.data ?? []).map((p) => (
                  <option key={p.key} value={p.key} disabled={!p.available}>
                    {p.label} {p.available ? '' : '(indisponible)'}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Button
            variant="primary"
            disabled={mode === 'eleve' ? !indivStudentId || (indivType === 'Bulletin' && !indivPeriod) : !indivStaffId}
            loading={signIndivMutation.isPending}
            onClick={() => signIndivMutation.mutate()}
          >
            Signer le document
          </Button>
          {signIndivMutation.error ? (
            <p style={{ fontSize: 12.5, color: 'var(--color-danger)', marginTop: 8 }}>
              {(signIndivMutation.error as Error).message}
            </p>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Documents signés"
          action={<Input id="doc-search" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 220 }} />}
        />
        {downloadMutation.error ? (
          <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>
            {(downloadMutation.error as Error).message}
          </p>
        ) : null}
        <StateView loading={documents.isLoading} error={documents.error} empty={filtered.length === 0}>
          <Table columns={columns} rows={filtered} rowKey={(d) => d.serie} />
        </StateView>
      </Card>
    </div>
  );
}
