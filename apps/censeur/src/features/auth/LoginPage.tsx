import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button, Field, Input, Sheet } from '@/components/ui';
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginByPhone, setLoginByPhone] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // CORRECTION (demande explicite) : un compte valide mais sans le rôle
  // SUPERVISOR/CENSEUR (voir `fetchDirectorProfile`) a droit à un popup qui dit
  // clairement « vous n'avez pas accès », pas au message générique de
  // connexion échouée affiché en ligne sous le formulaire.
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  // Compte bloqué (SUSPENDED) : popup dédié après code ACCOUNT_SUSPENDED (422) de la passerelle.
  const [blocked, setBlocked] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => auth.login(email, password, loginByPhone),
    onMutate: () => {
      setError(null);
      setAccessDenied(null);
      setBlocked(null);
      setAuthenticating();
    },
    onSuccess: (director) => {
      setDirector(director);
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    },
    onError: (err: unknown) => {
      if (err instanceof AppError && err.code === 'ACCOUNT_SUSPENDED') {
        setBlocked('Votre compte a été bloqué. Veuillez vous rapprocher de la direction de votre établissement.');
        return;
      }
      if (err instanceof AppError && err.kind === 'forbidden') {
        setAccessDenied(err.message);
        return;
      }
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
          <b>EduSénégal — Censeur</b>
        </div>
        <p className={styles.hint}>Espace réservé au censeur / surveillant général de l’établissement.</p>

        <fieldset className={styles.mode}>
          <legend className={styles.modeLegend}>Je me connecte avec</legend>
          <label className={styles.modeOption}>
            <input
              type="radio"
              name="loginMode"
              checked={loginByPhone}
              onChange={() => setLoginByPhone(true)}
            />
            Téléphone
          </label>
          <label className={styles.modeOption}>
            <input
              type="radio"
              name="loginMode"
              checked={!loginByPhone}
              onChange={() => setLoginByPhone(false)}
            />
            Matricule
          </label>
        </fieldset>

        <Field label="Identifiant (téléphone ou matricule)" required>
          <Input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder={loginByPhone ? '+221 77 000 00 00' : 'CEMT-LG-DR-0000013'}
            required
          />
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
      </form>

      <Sheet title="Accès refusé" open={accessDenied !== null} onClose={() => setAccessDenied(null)}>
        <p>{accessDenied}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Connectez-vous avec un compte censeur ou surveillant général, ou contactez votre établissement.
        </p>
      </Sheet>

      <Sheet title="Compte bloqué" open={blocked !== null} onClose={() => setBlocked(null)}>
        <p>{blocked}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Votre accès a été suspendu par l’administration de l’établissement. Rapprochez-vous de la
          direction pour le rétablir.
        </p>
      </Sheet>
    </div>
  );
}
