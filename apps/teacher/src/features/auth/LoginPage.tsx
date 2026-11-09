import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Sheet } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/stores/auth.store';
import { AppError } from '@/services/errors';
import styles from './LoginPage.module.css';
import { AuthIcon, type IconName } from './authIcons';

/* Configuration du rôle — ENSEIGNANT / PROFESSEUR (thème corail) */
const ROLE = {
  accent: '#f43f5e',
  panel: 'linear-gradient(140deg, #4c0519 0%, #881337 55%, #be123c 100%)',
  icon: 'book' as IconName,
  title: 'Enseignant / Professeur',
  pitch: 'Transmettez le savoir, façonnez l’avenir.',
  features: [
    { label: 'Gestion des cours', icon: 'book' as IconName },
    { label: 'Suivi des élèves', icon: 'users' as IconName },
    { label: 'Évaluations', icon: 'clipboard' as IconName },
    { label: 'Ressources pédagogiques', icon: 'folder' as IconName },
  ],
  quote: 'Chaque élève est une histoire qui mérite d’être écrite.',
  portal: 'Enseignant',
  welcomeSub: 'Enseignant / Professeur',
};

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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  const mutation = useMutation({
    mutationFn: () => auth.login(identifier, password, loginByPhone),
    onMutate: () => {
      setError(null);
      setAccessDenied(null);
      setBlocked(null);
      setAuthenticating();
    },
    onSuccess: (teacher) => {
      setTeacher(teacher);
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
    <div className={styles.screen} style={{ ['--accent' as string]: ROLE.accent, ['--panel' as string]: ROLE.panel }}>
      <aside className={styles.visual}>
        <span className={`${styles.blob} ${styles.blobA}`} />
        <span className={`${styles.blob} ${styles.blobB}`} />

        <div className={styles.brandRow}>
          <span className={styles.logoMark}><AuthIcon name="cap" size={22} /></span>
          <div>
            <b className={styles.brandName}>EduSénégal</b>
            <span className={styles.brandTag}>Ensemble pour une éducation de qualité</span>
          </div>
        </div>

        <div>
          <div className={styles.roleIcon}><AuthIcon name={ROLE.icon} size={26} /></div>
          <h1 className={styles.roleTitle}>{ROLE.title}</h1>
          <p className={styles.roleSubtitle}>{ROLE.pitch}</p>
          <ul className={styles.features}>
            {ROLE.features.map((f) => (
              <li key={f.label}>
                <span className={styles.featIcon}><AuthIcon name={f.icon} size={17} /></span>
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <p className={styles.quote}>« {ROLE.quote} »</p>
      </aside>

      <main className={styles.formSide}>
        <div className={styles.formInner}>
          <div className={styles.formTop}>
            <span className={styles.logoSmall}><AuthIcon name="cap" size={22} /> EduSénégal</span>
            <span className={styles.portalBadge}><AuthIcon name={ROLE.icon} size={15} /> Portail {ROLE.portal}</span>
          </div>

          <h2 className={styles.welcome}>Bienvenue sur votre espace</h2>
          <p className={styles.welcomeSub}>{ROLE.welcomeSub}</p>

          <form onSubmit={onSubmit}>
            <div className={styles.toggle} role="tablist" aria-label="Type d’identifiant">
              <button type="button" role="tab" aria-selected={loginByPhone}
                className={loginByPhone ? styles.toggleActive : styles.toggleBtn}
                onClick={() => setLoginByPhone(true)}>
                <AuthIcon name="phone" size={15} /> Téléphone
              </button>
              <button type="button" role="tab" aria-selected={!loginByPhone}
                className={!loginByPhone ? styles.toggleActive : styles.toggleBtn}
                onClick={() => setLoginByPhone(false)}>
                Matricule
              </button>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-id">
                Identifiant (téléphone ou matricule) <span className={styles.req}>*</span>
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><AuthIcon name="phone" size={18} /></span>
                <input id="login-id" className={styles.input} type="text" value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required
                  placeholder={loginByPhone ? '+221 77 000 00 00' : 'ENS-LG-0000000'} />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-pw">
                Mot de passe <span className={styles.req}>*</span>
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><AuthIcon name="lock" size={18} /></span>
                <input id="login-pw" className={styles.input} type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" required minLength={4} placeholder="Votre mot de passe" />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                  <AuthIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}

            <button type="submit" className={styles.submit} disabled={mutation.isPending}>
              {mutation.isPending ? 'Connexion…' : '→ Se connecter'}
            </button>

            <button type="button" className={styles.forgot} onClick={() => setForgot(true)}>
              Mot de passe oublié ?
            </button>
          </form>

          <div className={styles.footer}>
            <span className={styles.secure}><AuthIcon name="shield" size={14} /> Connexion sécurisée</span>
            <span>EduSénégal · Tous droits réservés</span>
          </div>
        </div>
      </main>

      <Sheet title="Accès refusé" open={accessDenied !== null} onClose={() => setAccessDenied(null)}>
        <p>{accessDenied}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Connectez-vous avec un compte ayant le rôle Enseignant, ou contactez votre établissement.
        </p>
      </Sheet>

      <Sheet title="Compte bloqué" open={blocked !== null} onClose={() => setBlocked(null)}>
        <p>{blocked}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Votre accès a été suspendu par l’administration de l’établissement. Rapprochez-vous de la
          direction pour le rétablir.
        </p>
      </Sheet>

      <Sheet title="Mot de passe oublié" open={forgot} onClose={() => setForgot(false)}>
        <p>Pour réinitialiser votre mot de passe, rapprochez-vous de l’administration de votre établissement.</p>
      </Sheet>
    </div>
  );
}
