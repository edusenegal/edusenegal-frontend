import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/stores/auth.store';
import { AppError } from '@/services/errors';
import type { School } from '@/types/domain';
import styles from './SchoolSelectionPage.module.css';

/**
 * Affichée une seule fois, juste après la connexion, quand l'enseignant a un
 * profil actif dans plusieurs écoles (`AuthSession.schools`) — voir
 * `ProtectedRoute`, qui redirige ici tant que `schoolConfirmed` est faux.
 * Une session restaurée (rechargement de page) ne repasse jamais par ici,
 * voir `restoreSession`.
 */
export default function SchoolSelectionPage() {
  const { auth, school } = useServices();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const schoolConfirmed = useAuthStore((s) => s.schoolConfirmed);
  const [error, setError] = useState<string | null>(null);
  const schoolIds = session?.schools ?? [];

  const schoolsQuery = useQuery({
    queryKey: ['auth', 'mySchools', schoolIds],
    queryFn: () => Promise.all(schoolIds.map((id) => school.getSchoolById(id))),
    enabled: schoolIds.length > 1,
  });

  const mutation = useMutation({
    mutationFn: (schoolId: string) => auth.switchSchool(schoolId),
    onMutate: () => setError(null),
    onSuccess: () => {
      // L'école active a changé (nouveau jeton, nouveau `school_id`) : la
      // couleur de marque (`BrandingGate`) vient de `['school']`, mis en
      // cache pour l'ancienne école — sans l'invalider, le professeur
      // garderait les couleurs de l'établissement précédent après avoir
      // basculé sur celui-ci.
      queryClient.invalidateQueries({ queryKey: ['school'] });
      navigate('/', { replace: true });
    },
    onError: (err: unknown) => setError(err instanceof AppError ? err.message : 'Impossible de changer d’école.'),
  });

  if (schoolConfirmed || schoolIds.length <= 1) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>Choisissez votre établissement</h1>
        <p className={styles.hint}>Vous enseignez dans plusieurs écoles sur EduSénégal.</p>

        <StateView loading={schoolsQuery.isLoading} error={schoolsQuery.error} onRetry={() => schoolsQuery.refetch()}>
          <ul className={styles.list}>
            {(schoolsQuery.data ?? []).map((item: School) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={styles.option}
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(item.id)}
                >
                  <span className={styles.name}>{item.name}</span>
                  <span className={styles.region}>{item.region}</span>
                </button>
              </li>
            ))}
          </ul>
        </StateView>

        {error ? <p className={styles.error}>{error}</p> : null}
        {mutation.isPending ? (
          <Button type="button" variant="primary" loading className={styles.submit}>
            Connexion à l’établissement…
          </Button>
        ) : null}
      </div>
    </div>
  );
}
