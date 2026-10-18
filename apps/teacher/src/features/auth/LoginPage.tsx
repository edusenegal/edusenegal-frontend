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
  const setTeacher = useAuthStore((s) => s.setTeacher);
  const setAuthenticating = useAuthStore((s) => s.setAuthenticating);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginByPhone, setLoginByPhone] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => auth.login(identifier, password, loginByPhone),
    onMutate: () => {
      setError(null);
      setAccessDenied(null);
      setAuthenticating();
    },
    onSuccess: (teacher) => {
      setTeacher(teacher);
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    },
    onError: (err: unknown) => {
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
          <b>EduSénégal — Enseignant</b>
        </div>
        <p className={styles.hint}>Espace réservé aux professeurs et instituteurs de l’établissement.</p>

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
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            placeholder={loginByPhone ? '+221 77 000 00 00' : 'CEMT-LG-ENS-0000013'}
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
          Connectez-vous avec un compte ayant le rôle Enseignant, ou contactez votre établissement.
        </p>
      </Sheet>
    </div>
  );
}
