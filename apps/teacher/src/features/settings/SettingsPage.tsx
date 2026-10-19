import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Button, Card, CardHeader, Field, Input } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Aperçu d'un fichier choisi mais pas encore envoyé — révoqué dès qu'il
 * n'est plus affiché (changement de fichier, annulation, démontage), pour
 * ne pas accumuler de blobs en mémoire. Même pattern que `apps/director`.
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
  const { auth, school } = useServices();
  const teacher = useAuthStore((s) => s.teacher);
  const setTeacher = useAuthStore((s) => s.setTeacher);

  // Les couleurs viennent toujours de l'école ACTIVE (même requête que
  // `BrandingGate`, qui les applique déjà à l'interface) — jamais modifiables
  // ici : seule la direction gère le branding de son établissement.
  const schoolQuery = useQuery({ queryKey: ['school'], queryFn: () => school.getSchool() });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoPreviewUrl = useFilePreview(photoFile);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoMutation = useMutation({
    mutationFn: () => auth.updateMyPhoto(photoFile as File),
    onSuccess: (updated) => {
      setTeacher(updated);
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    },
  });

  const [currentValue, setCurrentValue] = useState('');
  const [newValue, setNewValue] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => auth.changePassword(newValue),
    onSuccess: () => {
      setSuccess(true);
      setCurrentValue('');
      setNewValue('');
      setConfirmValue('');
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Échec de la mise à jour.'),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (newValue.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newValue !== confirmValue) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    mutation.mutate();
  }

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Votre profil et votre mot de passe." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Profil" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Avatar
            name={teacher ? `${teacher.prenom} ${teacher.nom}` : '—'}
            photoUrl={photoPreviewUrl ?? teacher?.photoUrl ?? null}
          />
          <div>
            <div style={{ fontWeight: 600 }}>
              {teacher?.prenom} {teacher?.nom}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              {teacher?.role === 'INSTITUTEUR' ? 'Instituteur' : 'Enseignant'} · {teacher?.email || teacher?.tel || '—'}
            </div>
          </div>
        </div>
        <Field label="Photo de profil" hint="Visible dans la barre latérale et partout où votre nom apparaît.">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13 }}
          />
          {photoPreviewUrl ? (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
              Aperçu du fichier sélectionné — pas encore enregistré.
            </p>
          ) : null}
        </Field>
        <Button
          variant="primary"
          size="sm"
          loading={photoMutation.isPending}
          disabled={!photoFile}
          onClick={() => photoMutation.mutate()}
          style={{ marginTop: 10 }}
        >
          Enregistrer la photo
        </Button>
      </Card>

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Couleurs de l'établissement" />
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
          {schoolQuery.data ? `Couleurs de ${schoolQuery.data.name}` : 'Couleurs de votre établissement actif.'} — gérées par la direction, pas modifiables ici.
        </p>
        <div style={{ display: 'flex', gap: 20 }}>
          <ColorSwatch label="Couleur principale" hex={schoolQuery.data?.primaryColor} />
          <ColorSwatch label="Couleur secondaire" hex={schoolQuery.data?.secondaryColor} />
        </div>
      </Card>

      <Card padded>
        <CardHeader title="Changer le mot de passe" />
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
          {/*
            Note : le backend (`UserController#changePassword`) n'exige pas
            encore l'ancien mot de passe (voir son commentaire F-USR-8,
            "non appliqué") — ce champ reste affiché pour l'habitude de
            saisie mais n'est pas transmis.
          */}
          <Field label="Mot de passe actuel">
            <Input type="password" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="Nouveau mot de passe" required>
            <Input type="password" value={newValue} onChange={(e) => setNewValue(e.target.value)} autoComplete="new-password" minLength={8} required />
          </Field>
          <Field label="Confirmer le nouveau mot de passe" required>
            <Input type="password" value={confirmValue} onChange={(e) => setConfirmValue(e.target.value)} autoComplete="new-password" minLength={8} required />
          </Field>
          {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
          {success ? <p style={{ color: 'var(--color-success)', fontSize: 13 }}>Mot de passe mis à jour.</p> : null}
          <Button type="submit" variant="primary" loading={mutation.isPending}>
            Mettre à jour
          </Button>
        </form>
      </Card>
    </div>
  );
}

function ColorSwatch({ label, hex }: { label: string; hex: string | undefined }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: hex ?? 'transparent',
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{hex ?? '—'}</div>
      </div>
    </div>
  );
}
