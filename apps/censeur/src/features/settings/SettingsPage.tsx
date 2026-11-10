import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { Button, Card, CardHeader, Field, Input } from '@/components/ui';
import { CameraCapture } from '@/components/ui/CameraCapture/CameraCapture';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/stores/auth.store';
import { applyBranding } from '@/utils/branding';

/**
 * Aperçu d'un fichier choisi mais pas encore envoyé — `URL.createObjectURL`
 * plutôt qu'un data-URL (plus léger pour une image), révoqué dès qu'il
 * n'est plus affiché (changement de fichier, annulation, ou démontage) pour
 * ne pas accumuler de blobs en mémoire. Partagé par la photo de profil et
 * le logo (prévisualiser avant d'envoyer).
 */
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

export default function SettingsPage() {
  // Censeur/surveillant général : peut tout faire ici SAUF importer le
  // cachet et la signature — acte réservé à la direction (voir la carte
  // « Cachet et signature » absente dans cette application).
  const { school, auth } = useServices();
  const queryClient = useQueryClient();
  const director = useAuthStore((s) => s.director);
  const setDirector = useAuthStore((s) => s.setDirector);
  const schoolQuery = useQuery({ queryKey: ['school'], queryFn: () => school.getSchool() });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const photoPreviewUrl = useFilePreview(photoFile);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoMutation = useMutation({
    mutationFn: () => auth.updateMyPhoto(photoFile as File),
    onSuccess: (updated) => {
      setDirector(updated);
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    },
  });

  const [primaryColor, setPrimaryColor] = useState('#0C241C');
  const [secondaryColor, setSecondaryColor] = useState('#1D9E75');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoPreviewUrl = useFilePreview(logoFile);
  void logoPreviewUrl; // carte branding commentée — placeholder jusqu'à réactivation
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (schoolQuery.data) {
      setPrimaryColor(schoolQuery.data.primaryColor);
      setSecondaryColor(schoolQuery.data.secondaryColor);
      setTelephone(schoolQuery.data.telephone === '—' ? '' : schoolQuery.data.telephone);
      setEmail(schoolQuery.data.email === '—' ? '' : schoolQuery.data.email);
    }
  }, [schoolQuery.data]);

  const appearanceMutation = useMutation({
    mutationFn: async () => {
      const afterColors = await school.updateBranding({ primaryColor, secondaryColor });
      if (!logoFile) return afterColors;
      return school.uploadLogo(logoFile);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['school'], updated);
      applyBranding(updated);
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
    },
  });
  void appearanceMutation; // carte branding commentée — placeholder jusqu'à réactivation

  const contactMutation = useMutation({
    mutationFn: () => school.updateContactInfo({ telephone, email }),
    onSuccess: (updated) => queryClient.setQueryData(['school'], updated),
  });

  const s = schoolQuery.data;

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Informations de l’établissement et apparence." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Card padded>
          <CardHeader title="Établissement" />
          {s ? (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
              <Row k="Nom" v={s.name} />
              <Row k="Type" v={s.type === 'prive' ? 'Privé' : 'Public'} />
              <Row k="Niveau" v="Lycée" />
              <Row k="Région" v={s.region} />
              <Row k="Adresse" v={s.adresse} />
              <Field label="Téléphone">
                <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+221…" />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@etablissement.sn"
                />
              </Field>
              <Button
                variant="primary"
                loading={contactMutation.isPending}
                onClick={() => contactMutation.mutate()}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
              >
                Enregistrer
              </Button>
            </div>
          ) : null}
        </Card>

        <Card padded>
          <CardHeader title="Mon profil" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Photo de profil" hint="Visible dans la barre latérale et partout où votre nom apparaît.">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Avatar
                  name={director ? `${director.prenom} ${director.nom}` : ''}
                  photoUrl={photoPreviewUrl ?? director?.photoUrl ?? null}
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
              {cameraOpen ? (
                <CameraCapture
                  onCapture={(f) => {
                    setPhotoFile(f);
                    setCameraOpen(false);
                  }}
                  onClose={() => setCameraOpen(false)}
                />
              ) : null}
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

        {/* <Card padded>
          <CardHeader title="Apparence" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Logo de l’établissement" hint="Affiché dans la barre latérale et sur les bulletins.">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <img
                  src={logoPreviewUrl ?? s?.logoUrl ?? undefined}
                  alt={logoPreviewUrl ? 'Aperçu du nouveau logo' : 'Logo actuel'}
                  style={{
                    width: 48,
                    height: 48,
                    objectFit: 'contain',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    display: s?.logoUrl || logoPreviewUrl ? 'block' : 'none',
                  }}
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: 13 }}
                />
              </div>
              {logoPreviewUrl ? (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  Aperçu du fichier sélectionné — pas encore enregistré.
                </p>
              ) : null}
            </Field>
            <Field label="Couleur primaire" hint="Fond de la barre latérale.">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: 44, height: 36, border: '1px solid var(--color-border-strong)', borderRadius: 8, padding: 2 }}
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ maxWidth: 140 }} />
              </div>
            </Field>
            <Field label="Couleur secondaire" hint="Fond des boutons et de la section choisie dans le menu.">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  style={{ width: 44, height: 36, border: '1px solid var(--color-border-strong)', borderRadius: 8, padding: 2 }}
                />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ maxWidth: 140 }} />
              </div>
            </Field>
            <Button variant="primary" loading={appearanceMutation.isPending} onClick={() => appearanceMutation.mutate()}>
              Enregistrer
            </Button>
          </div>
        </Card> */}

      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
