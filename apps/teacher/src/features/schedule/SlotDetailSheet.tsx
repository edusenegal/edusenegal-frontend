import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, Sheet, StateView, Textarea } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtBytes } from '@/utils/format';
import type { TimetableSlot } from '@/types/domain';

interface SlotDetailSheetProps {
  slot: TimetableSlot | null;
  /** Date réelle de cette occurrence du créneau (résolue par `SchedulePage` — voir `dateForWeekdayThisWeek`/la grille mensuelle). */
  slotDate: Date | null;
  onClose(): void;
}

/** Combine une date calendaire et une heure "HH:mm" en un instant précis. */
function atTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours ?? 0, minutes ?? 0);
}

/**
 * Détail d'un créneau — ouvert en cliquant sur un cours dans `SchedulePage`
 * (vue semaine ou mois). Permet d'ajouter une note de préparation libre
 * (`timetable.updateDescription`) et d'y rattacher des fichiers
 * (`courseDocuments`, filtré par `timetableSlotId`) — tant que l'horaire du
 * créneau n'est pas déjà passé (demande explicite) : au-delà de l'heure de
 * fin, le contenu reste consultable mais plus modifiable.
 */
export function SlotDetailSheet({ slot, slotDate, onClose }: SlotDetailSheetProps) {
  const { timetable, courseDocuments } = useServices();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState(slot?.description ?? '');
  const [chapitre, setChapitre] = useState('');
  const [savedSlotId, setSavedSlotId] = useState(slot?.id ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Le Sheet reste monté (fermeture animée) : on resynchronise l'état local
  // seulement quand le créneau affiché change réellement.
  if (slot && slot.id !== savedSlotId) {
    setDescription(slot.description ?? '');
    setChapitre('');
    setSavedSlotId(slot.id);
  }

  const isPast = slot && slotDate ? atTime(slotDate, slot.heureFin) < new Date() : false;

  const documentsQuery = useQuery({
    queryKey: ['course-documents', 'slot', slot?.id],
    queryFn: () => courseDocuments.listForSlot(slot!.id),
    enabled: slot !== null,
  });

  const saveDescription = useMutation({
    mutationFn: (value: string) => timetable.updateDescription(slot!.id, value.trim() || null),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['timetable', 'mine'] });
    },
    onError: () => setError('Impossible d’enregistrer la description.'),
  });

  const uploadFile = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Aucun fichier sélectionné.');
      if (!chapitre.trim()) throw new Error('Le chapitre est obligatoire.');
      return courseDocuments.upload({
        subjectId: slot!.subjectId ?? undefined,
        timetableSlotId: slot!.id,
        type: 'ressource',
        titre: chapitre.trim(),
        file,
      });
    },
    onSuccess: () => {
      setFile(null);
      setChapitre('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['course-documents', 'slot', slot?.id] });
    },
    onError: () => setError('Échec du dépôt du fichier.'),
  });

  const removeFile = useMutation({
    mutationFn: (documentId: string) => courseDocuments.remove(documentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course-documents', 'slot', slot?.id] }),
  });

  return (
    <Sheet title={slot ? `${slot.matiere ?? 'Créneau'} — ${slot.classe}` : 'Créneau'} open={slot !== null} onClose={onClose}>
      {slot ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {slot.jour} · {slot.heureDebut} – {slot.heureFin}
            {slot.salle ? <> · Salle {slot.salle}</> : null}
          </div>

          {isPast ? (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: 0 }}>
              Ce créneau est terminé — son contenu reste consultable mais n'est plus modifiable.
            </p>
          ) : null}

          <Field label="Description / note de préparation">
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isPast} />
          </Field>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={saveDescription.isPending}
            disabled={isPast}
            onClick={() => saveDescription.mutate(description)}
          >
            Enregistrer la description
          </Button>

          <div>
            <h3 style={{ fontSize: 13.5, margin: '0 0 8px' }}>Fichiers joints</h3>
            <StateView loading={documentsQuery.isLoading} error={documentsQuery.error} empty={documentsQuery.data?.length === 0}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(documentsQuery.data ?? []).map((doc) => (
                  <li
                    key={doc.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px' }}
                  >
                    <a href={doc.downloadUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                      {doc.titre}
                    </a>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>{fmtBytes(doc.fileSizeBytes)}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeFile.mutate(doc.id)}>
                        Supprimer
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </StateView>

            {!isPast ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                <Field label="Chapitre" hint="Nom du chapitre associé au fichier déposé.">
                  <Input
                    value={chapitre}
                    onChange={(e) => setChapitre(e.target.value)}
                    placeholder="Ex: Chapitre 3 — Les fractions"
                  />
                </Field>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input ref={fileInputRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }} />
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={uploadFile.isPending}
                    disabled={!file || !chapitre.trim()}
                    onClick={() => uploadFile.mutate()}
                  >
                    Ajouter
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>{error}</p> : null}
        </div>
      ) : null}
    </Sheet>
  );
}
