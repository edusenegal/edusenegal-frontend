import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Select, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { downloadBlob } from '@/utils/format';
import type { Mention, SubjectAverage } from '@/types/domain';

const MENTION_LABEL: Record<Mention, string> = {
  excellent: 'Excellent',
  tres_bien: 'Très bien',
  bien: 'Bien',
  assez_bien: 'Assez bien',
  passable: 'Passable',
  insuffisant: 'Insuffisant',
};

export default function ResultsPage() {
  const { myClasses, results } = useServices();

  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });

  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [semestre, setSemestre] = useState(1);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // CORRECTION (signalé) — « je veux pouvoir prévisualiser le bulletin en
  // popup » : l'aperçu garde le blob + son nom de fichier (pour que
  // "Télécharger" depuis la popup ne refasse pas l'appel réseau) et une
  // URL d'objet, révoquée à la fermeture pour ne pas fuir de mémoire.
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);

  const rosterQuery = useQuery({
    queryKey: ['roster', classId],
    queryFn: () => myClasses.roster(classId),
    enabled: classId !== '',
  });

  const resultQuery = useQuery({
    queryKey: ['semester-result', studentId, semestre],
    queryFn: () => results.getStudentSemesterResult(studentId, semestre),
    enabled: studentId !== '',
  });

  const columns: Column<SubjectAverage>[] = [
    { key: 'matiere', header: 'Matière', render: (s) => s.subjectNom },
    { key: 'moyenne', header: 'Moyenne', render: (s) => `${s.moyenne.toFixed(2)}/20` },
    { key: 'coefficient', header: 'Coef.', render: (s) => String(s.coefficient) },
    { key: 'mention', header: 'Mention', render: (s) => MENTION_LABEL[s.mention] },
  ];

  async function onDownload() {
    try {
      setDownloadError(null);
      await results.downloadBulletinPdf(studentId, semestre);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Échec du téléchargement.');
    }
  }

  async function onPreview() {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const { blob, filename } = await results.getBulletinPdfBlob(studentId, semestre);
      previewBlobRef.current = blob;
      setPreview({ url: URL.createObjectURL(blob), filename });
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Échec de l'aperçu.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    previewBlobRef.current = null;
    setPreview(null);
  }

  // Révoque l'URL d'objet si le composant disparaît pendant que l'aperçu est ouvert.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  function downloadFromPreview() {
    if (!preview || !previewBlobRef.current) return;
    downloadBlob(previewBlobRef.current, preview.filename);
  }

  return (
    <div>
      <PageHeader title="Résultats & bulletins" subtitle="Moyennes semestrielles d’un élève et téléchargement du bulletin." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Filtre" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Classe">
            <Select value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(''); }} style={{ width: 180 }}>
              <option value="">Choisir…</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Élève">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ width: 220 }} disabled={classId === ''}>
              <option value="">Choisir…</option>
              {(rosterQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.prenom} {s.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Semestre">
            <Select value={String(semestre)} onChange={(e) => setSemestre(Number(e.target.value))} style={{ width: 120 }}>
              {[1, 2, 3, 4].map((s) => (
                <option key={s} value={s}>
                  Semestre {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {studentId ? (
        <Card>
          <StateView loading={resultQuery.isLoading} error={resultQuery.error}>
            {resultQuery.data ? (
              <>
                <CardHeader
                  title={`Moyenne générale : ${resultQuery.data.moyenneGenerale.toFixed(2)}/20 — rang ${resultQuery.data.rangClasse}/${resultQuery.data.totalEleves}`}
                  action={
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge tone={resultQuery.data.publie ? 'success' : 'neutral'}>{resultQuery.data.publie ? 'Publié' : 'Non publié'}</Badge>
                      <Button variant="secondary" size="sm" loading={previewLoading} onClick={onPreview}>
                        Aperçu du bulletin
                      </Button>
                      <Button variant="secondary" size="sm" onClick={onDownload}>
                        Télécharger le bulletin (PDF)
                      </Button>
                    </div>
                  }
                />
                {downloadError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{downloadError}</p> : null}
                {previewError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{previewError}</p> : null}
                <Table columns={columns} rows={resultQuery.data.matieres} rowKey={(s) => s.subjectId} />
              </>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                Les moyennes de ce semestre ne sont pas encore disponibles pour cet élève.
              </p>
            )}
          </StateView>
        </Card>
      ) : null}

      <Sheet
        title={preview ? `Aperçu — ${preview.filename}` : 'Aperçu du bulletin'}
        open={preview !== null}
        onClose={closePreview}
        width="lg"
        footer={
          preview ? (
            <Button variant="primary" onClick={downloadFromPreview}>
              Télécharger le PDF
            </Button>
          ) : undefined
        }
      >
        {preview ? (
          <iframe
            src={preview.url}
            title="Aperçu du bulletin"
            style={{ width: '100%', height: '70vh', border: 'none', display: 'block' }}
          />
        ) : null}
      </Sheet>
    </div>
  );
}
