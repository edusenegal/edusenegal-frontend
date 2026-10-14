import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button, Field, Input } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/stores/auth.store';
import { AppError } from '@/services/errors';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { auth } = useServices();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useAuthStore((s) => s.status);
  const setDirector = useAuthStore((s) => s.setDirector);
  const setAuthenticating = useAuthStore((s) => s.setAuthenticating);

  const [email, setEmail] = useState('a.diagne@lyceelesflamboyants.sn');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => auth.login(email, password),
    onMutate: () => {
      setError(null);
      setAuthenticating();
    },
    onSuccess: (director) => {
      setDirector(director);
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    },
    onError: (err: unknown) => {
      setError(err instanceof AppError ? err.message : 'Connexion impossible.');
    },
  });

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={onSubmit}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            ◆
          </span>
          <b>EduSénégal — Direction</b>
        </div>
        <p className={styles.hint}>Espace réservé à la direction de l’établissement.</p>

        <Field label="Adresse e-mail" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label="Mot de passe" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            minLength={4}
          />
        </Field>

        {error ? <p className={styles.error}>{error}</p> : null}

        <Button type="submit" variant="primary" loading={mutation.isPending} className={styles.submit}>
          Se connecter
        </Button>

        <p className={styles.demo}>Branche de démonstration — tout mot de passe d’au moins 4 caractères est accepté.</p>
      </form>
    </div>
  );
}
