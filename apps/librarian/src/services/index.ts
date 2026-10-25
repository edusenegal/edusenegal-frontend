/**
 * Assemblage des services — espace bibliothécaire (branche api).
 * Seul fichier qui diffère de la branche mock-api : ici, services HTTP réels
 * (`src/api/`, `createApiServices()`) branchés sur le library-service.
 */
import { createApiServices } from '@/api';
import type { Services } from '@/services/ports';

export const services: Services = createApiServices();

export const SERVICES_MODE = 'api' as const;
