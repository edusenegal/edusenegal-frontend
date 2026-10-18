/**
 * Assemblage des services — espace enseignant.
 *
 * Contrairement à `apps/director` (qui porte encore un filet mock pour les
 * ports non migrés), cette application est neuve et chaque port est réel
 * dès le premier jour — même convention que `apps/comptable`.
 */

import { createApiServices } from '@/api';
import type { Services } from '@/services/ports';

export const services: Services = createApiServices();

export const SERVICES_MODE = 'api' as const;
