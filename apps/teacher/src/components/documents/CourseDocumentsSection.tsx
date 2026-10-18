import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Field, Input, Select, StateView, Textarea } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtBytes } from '@/utils/format';
import type { CourseDocumentType } from '@/types/domain';

const TYPE_LABEL: Record<CourseDocumentType, string> = {
  cours: 'Cours',
  exercice: 'Exercice',
  corrige: 'Corrigé',
  sujet_examen: 'Sujet d’examen',
  ressource: 'Ressource',
  autre: 'Autre',
};

const TYPES: CourseDocumentType[] = ['cours', 'exercice', 'corrige', 'sujet_examen', 'ressource', 'autre'];

interface CourseDocumentsSectionProps {
  subjectId: string;
}

/**
 * Documents pédagogiques d'une matière (cours, exercices, corrigés, sujets
 * d'examen, ressources) — backend : `document-service`, `/api/v1/documents`
 * (voir `CourseDocumentsPort`), déjà pris en charge côté serveur, simplement
 * non exposé côté frontend avant cette fiche.
 */
export function CourseDocumentsSection({ subjectId }: CourseDocumentsSectionProps) {
  const { courseDocuments } = useServices();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const list = useQuery({
    queryKey: ['course-documents', subjectId],
    queryFn: () => courseDocuments.list(subjectId),
  });

  const [type, setType] = useState<CourseDocumentType>(TYPES[0]!);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['course-documents', subjectId] });
  }

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Aucun fichier sélectionné.');
      return courseDocuments.upload({ subjectId, type, titre: titre.trim(), description: description.trim() || undefined, file });
    },
    onSuccess: () => {
      invalidate();
      setTitre('');
      setDescription('');
      setFile(null);
      setType(TYPES[0]!);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Échec du dépôt.'),
  });

  const removeMutation = useMutation({
    mutationFn: (documentId: string) => courseDocuments.remove(documentId),
    onSuccess: invalidate,
  });

  function onSubmit() {
    if (!titre.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }
    if (!file) {
      setError('Sélectionnez un fichier.');
      return;
    }
    uploadMutation.mutate();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as CourseDocumentType)} style={{ width: 170 }}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Titre" required>
          <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Chapitre 3 — Fonctions" style={{ width: 220 }} />
        </Field>
        <Field label="Description">
          <Textarea rows={1} value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: 220 }} />
        </Field>
        <Field label="Fichier" required>
          <input ref={fileInputRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }} />
        </Field>
        <Button variant="primary" size="sm" loading={uploadMutation.isPending} onClick={onSubmit}>
          Déposer
        </Button>
      </div>
      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>{error}</p> : null}

      <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Titre</th>
              <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Type</th>
              <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Taille</th>
              <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Déposé le</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}></th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((doc) => (
              <tr key={doc.id}>
                <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>
                  {doc.titre}
                  {doc.description ? <div style={{ color: 'var(--color-text-muted)', fontSize: 11.5 }}>{doc.description}</div> : null}
                </td>
                <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>
                  <Badge tone="info">{TYPE_LABEL[doc.type]}</Badge>
                </td>
                <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>{fmtBytes(doc.fileSizeBytes)}</td>
                <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>{doc.dateDepot}</td>
                <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <a href={doc.downloadUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, marginRight: 10 }}>
                    Télécharger
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(doc.id)}>
                    Supprimer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </StateView>
    </div>
  );
}
