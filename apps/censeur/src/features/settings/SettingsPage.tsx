import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { Button, Card, CardHeader, Field, Input } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/stores/auth.store';
import { applyBranding } from '@/utils/branding';

/**
 * Aperçu d'un fichier choisi mais pas encore envoyé — `URL.createObjectURL`
 * plutôt qu'un data-URL (plus léger pour une image), révoqué dès qu'il
 * n'est plus affiché (changement de fichier, annulation, ou démontage) pour
 * ne pas accumuler de blobs en mémoire. Partagé par le logo, le cachet et
 * la signature (nouvelle demande direction — prévisualiser avant d'envoyer).
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
  const { school, signatures, auth } = useServices();
  const queryClient = useQueryClient();
  const director = useAuthStore((s) => s.director);
  const setDirector = useAuthStore((s) => s.setDirector);
  const schoolQuery = useQuery({ queryKey: ['school'], queryFn: () => school.getSchool() });
  const assetsQuery = useQuery({ queryKey: ['signer-assets'], queryFn: () => signatures.getMyAssets() });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
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

  const contactMutation = useMutation({
    mutationFn: () => school.updateContactInfo({ telephone, email }),
    onSuccess: (updated) => queryClient.setQueryData(['school'], updated),
  });

  const [stampFile, setStampFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const stampNewPreviewUrl = useFilePreview(stampFile);
  const signatureNewPreviewUrl = useFilePreview(signatureFile);
  const assetsMutation = useMutation({
    mutationFn: () => signatures.updateMyAssets({ stamp: stampFile, signature: signatureFile }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['signer-assets'], updated);
      setStampFile(null);
      setSignatureFile(null);
    },
  });

  const s = schoolQuery.data;
  const assets = assetsQuery.data;

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

        <Card padded>
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
        </Card>

        <Card padded>
          <CardHeader title="Cachet et signature" />
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 14 }}>
            Enregistrés une seule fois ici, réutilisés automatiquement sur chaque bulletin signé
            électroniquement (cachet en bas à gauche, signature en bas à droite).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Cachet de l’établissement">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {stampNewPreviewUrl ?? assets?.stampPreviewUrl ? (
                  <img
                    src={stampNewPreviewUrl ?? assets?.stampPreviewUrl ?? undefined}
                    alt={stampNewPreviewUrl ? 'Aperçu du nouveau cachet' : 'Cachet actuel'}
                    style={{ width: 48, height: 48, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: 6 }}
                  />
                ) : null}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setStampFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: 13 }}
                />
              </div>
              {stampNewPreviewUrl ? (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  Aperçu du fichier sélectionné — pas encore enregistré.
                </p>
              ) : null}
            </Field>
            <Field label="Signature manuscrite">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {signatureNewPreviewUrl ?? assets?.signaturePreviewUrl ? (
                  <img
                    src={signatureNewPreviewUrl ?? assets?.signaturePreviewUrl ?? undefined}
                    alt={signatureNewPreviewUrl ? 'Aperçu de la nouvelle signature' : 'Signature actuelle'}
                    style={{ width: 70, height: 32, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: 6 }}
                  />
                ) : null}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSignatureFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: 13 }}
                />
              </div>
              {signatureNewPreviewUrl ? (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  Aperçu du fichier sélectionné — pas encore enregistré.
                </p>
              ) : null}
            </Field>
            <Button
              variant="primary"
              loading={assetsMutation.isPending}
              disabled={!stampFile && !signatureFile}
              onClick={() => assetsMutation.mutate()}
              style={{ alignSelf: 'flex-start' }}
            >
              Enregistrer
            </Button>
          </div>
        </Card>
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
