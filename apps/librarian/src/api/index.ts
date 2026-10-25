import { createAuthApi } from '@/api/auth.api';
import { createSchoolApi } from '@/api/school.api';
import { createLibraryApi } from '@/api/library.api';
import type { Services } from '@/services/ports';

/** Assemblage des services HTTP — espace bibliothécaire (branche api). */
export function createApiServices(): Services {
  return {
    auth: createAuthApi(),
    school: createSchoolApi(),
    library: createLibraryApi(),
  };
}
