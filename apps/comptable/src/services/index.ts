/**
 * Assemblage des services — implémentations HTTP sur l'api-gateway.
 * Voir `apps/director/src/services/index.ts` pour la même convention.
 */

import { createApiServices } from '@/api';
import type { Services } from '@/services/ports';

export const services: Services = createApiServices();
