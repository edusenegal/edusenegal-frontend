import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Button, Card, CardHeader, Field, Input } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/stores/auth.store';

export default function SettingsPage() {
  const { auth } = useServices();
  const teacher = useAuthStore((s) => s.teacher);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={teacher ? `${teacher.prenom} ${teacher.nom}` : '—'} photoUrl={teacher?.photoUrl ?? null} />
          <div>
            <div style={{ fontWeight: 600 }}>
              {teacher?.prenom} {teacher?.nom}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              {teacher?.role === 'INSTITUTEUR' ? 'Instituteur' : 'Enseignant'} · {teacher?.email || teacher?.tel || '—'}
            </div>
          </div>
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
