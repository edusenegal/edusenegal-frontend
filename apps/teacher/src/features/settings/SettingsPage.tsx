import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Button, Card, CardHeader, Field, Input, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/stores/auth.store';
import type { School } from '@/types/domain';

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
  const schoolIds = useAuthStore((s) => s.session?.schools ?? []);

  // Les couleurs viennent toujours de l'école ACTIVE (même requête que
  // `BrandingGate`, qui les applique déjà à l'interface) — jamais modifiables
  // ici : seule la direction gère le branding de son établissement.
  const schoolQuery = useQuery({ queryKey: ['school'], queryFn: () => school.getSchool() });

  // Écoles où l'enseignant a un profil actif — un professeur peut enseigner
  // dans plusieurs établissements, voir `SchoolSelectionPage`. Simple liste
  // en lecture ici ; le changement d'école actif se fait depuis cet écran-là.
  const mySchoolsQuery = useQuery({
    queryKey: ['auth', 'mySchools', schoolIds],
    queryFn: () => Promise.all(schoolIds.map((id) => school.getSchoolById(id))),
    enabled: schoolIds.length > 0,
  });

  const [emailValue, setEmailValue] = useState(teacher?.email ?? '');
  const [emailEditing, setEmailEditing] = useState(false);
  useEffect(() => {
    if (!emailEditing) setEmailValue(teacher?.email ?? '');
  }, [teacher?.email, emailEditing]);
  const emailMutation = useMutation({
    mutationFn: () => auth.updateMyEmail(emailValue.trim()),
    onSuccess: (updated) => {
      setTeacher(updated);
      setEmailEditing(false);
    },
  });

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

        <Field label="Adresse e-mail" hint="Utilisée pour vous identifier et pour les notifications.">
          <div style={{ display: 'flex', gap: 8, maxWidth: 360 }}>
            <Input
              type="email"
              value={emailValue}
              onChange={(e) => {
                setEmailEditing(true);
                setEmailValue(e.target.value);
              }}
            />
            <Button
              variant="primary"
              size="sm"
              loading={emailMutation.isPending}
              disabled={!emailValue.trim() || emailValue.trim() === (teacher?.email ?? '')}
              onClick={() => emailMutation.mutate()}
            >
              Enregistrer
            </Button>
          </div>
          {emailMutation.isSuccess && !emailEditing ? (
            <p style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 6 }}>E-mail mis à jour.</p>
          ) : null}
          {emailMutation.isError ? (
            <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 6 }}>
              Impossible de mettre à jour l'e-mail.
            </p>
          ) : null}
        </Field>
      </Card>

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Mes établissements" />
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
          {schoolIds.length > 1
            ? 'Écoles où vous enseignez — basculez depuis l\'écran de choix d\'école à la connexion.'
            : 'École où vous enseignez.'}
        </p>
        <StateView loading={mySchoolsQuery.isLoading} error={mySchoolsQuery.error} onRetry={() => mySchoolsQuery.refetch()}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(mySchoolsQuery.data ?? []).map((item: School) => (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: item.id === schoolQuery.data?.id ? 'var(--color-surface-muted, #f6f6f6)' : undefined,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {item.id === schoolQuery.data?.id ? 'Active' : item.region}
                </span>
              </li>
            ))}
          </ul>
        </StateView>
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
