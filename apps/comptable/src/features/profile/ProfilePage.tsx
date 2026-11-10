import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Button, Card, CardHeader, Field } from '@/components/ui';
import { CameraCapture } from '@/components/ui/CameraCapture/CameraCapture';
import { useServices } from '@/hooks/useServices';

/** Aperçu local d'un fichier image avant envoi (révoqué au démontage). */
function useFilePreview(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

export default function ProfilePage() {
  const { auth } = useServices();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => auth.currentAccountant() });
  const profile = me.data;

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const photoPreviewUrl = useFilePreview(photoFile);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoMutation = useMutation({
    mutationFn: () => auth.updateMyPhoto(photoFile as File),
    onSuccess: () => {
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  return (
    <div>
      <PageHeader title="Mon profil" subtitle={profile ? `${profile.prenom} ${profile.nom}` : undefined} />
      <Card padded>
        <CardHeader title="Photo de profil" />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Photo" hint="Visible dans la barre latérale et partout où votre nom apparaît.">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Avatar
                name={profile ? `${profile.prenom} ${profile.nom}` : ''}
                photoUrl={photoPreviewUrl ?? profile?.photoUrl ?? null}
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 13 }}
              />
              <Button variant="ghost" size="sm" onClick={() => setCameraOpen(true)}>
                Prendre une photo
              </Button>
            </div>
            {photoPreviewUrl ? (
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Aperçu du fichier sélectionné — pas encore enregistré.
              </p>
            ) : null}
          </Field>
          <Button
            variant="primary"
            loading={photoMutation.isPending}
            disabled={!photoFile}
            onClick={() => photoMutation.mutate()}
            style={{ alignSelf: 'flex-start' }}
          >
            Enregistrer
          </Button>
        </div>
      </Card>
      {cameraOpen ? (
        <CameraCapture
          onCapture={(f) => {
            setPhotoFile(f);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      ) : null}
    </div>
  );
}
