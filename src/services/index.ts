/**
 * Assemblage des services.
 *
 * C'est le seul fichier qui devrait changer entre les branches :
 *  - branche `mock` (celle-ci) → implémentations de démonstration en
 *    mémoire, limitées à un lycée ;
 *  - une future branche `api` → implémentations HTTP sur l'api-gateway,
 *    dans `src/api/`, suivant exactement le modèle de `student/web`.
 *
 * Tout le reste de l'application — écrans, composants, types, store —
 * est identique d'une branche à l'autre : voir le README, section
 * "Les deux branches".
 */

import { createMockServices } from '@/services/mock';
import type { Services } from '@/services/ports';

export const services: Services = createMockServices();

export const SERVICES_MODE = 'mock' as const;
