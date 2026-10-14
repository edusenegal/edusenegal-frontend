import { QueryClient } from '@tanstack/react-query';

/**
 * Fabrique plutôt qu'un singleton exporté : les tests passent leur propre
 * client à `<Providers queryClientOverride=…>` sans toucher ce module.
 *
 * `staleTime` à 30 s : les écrans de direction (effectifs, caisse,
 * demandes) ne changent pas seconde par seconde, ce qui évite une requête
 * à chaque retour sur un écran déjà visité récemment. `retry: 1` plutôt que
 * la valeur par défaut (3) : sur la branche `mock`, un échec résout toujours
 * au prochain essai ; côté réel, trois essais avant d'afficher l'erreur
 * ferait juste attendre pour rien.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
