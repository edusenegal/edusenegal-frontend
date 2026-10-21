/**
 * Assemblage des services.
 *
 * C'est le seul fichier qui devrait changer entre les branches :
 *  - branche `mock` → implémentations de démonstration en mémoire, limitées
 *    à un lycée ;
 *  - branche `api` (celle-ci) → implémentations HTTP sur l'api-gateway,
 *    dans `src/api/`, suivant le modèle de `student/web`. Portage en cours
 *    écran par écran — voir `src/api/index.ts`.
 *
 * Tout le reste de l'application — écrans, composants, types — est
 * identique d'une branche à l'autre : voir le README, section
 * "Les deux branches".
 */

import { createApiServices } from '@/api';
import type { Services } from '@/services/ports';

export const services: Services = createApiServices();

export const SERVICES_MODE = 'api' as const;
