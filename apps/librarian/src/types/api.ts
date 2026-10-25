/**
 * DTO minimaux partagés avec `stores/auth.store`. Sur la branche `mock-api`,
 * l'auth ne produit pas de vrais jetons ; ces types décrivent la forme que la
 * branche `api` renverra (voir `src/api/auth.api.ts` côté branche api).
 */
export type UserRole =
  | 'LIBRARIAN'
  | 'DIRECTOR'
  | 'TEACHER'
  | 'SUPER_ADMIN'
  | string;

export type ApiSchoolType = 'PRIMAIRE' | 'COLLEGE' | 'LYCEE' | 'UNIVERSITE';

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId?: string;
  activeSchoolId?: string;
  schoolUserId?: string;
  schoolIndicatif?: string;
  role?: UserRole;
  schoolType?: ApiSchoolType;
  mustChangePassword: boolean;
}

/** Corps d'erreur renvoyé par la passerelle. */
export interface ApiErrorDto {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  code?: string;
}

/** Sous-ensemble de UserResponse (user-service) utilisé par l'auth. */
export interface UserResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  role: UserRole;
  photoUrl?: string | null;
  accountStatus?: string;
}

/** Sous-ensemble de SchoolResponse (school-service) utilisé pour le branding. */
export interface SchoolResponseDto {
  id: string;
  name: string;
  type?: ApiSchoolType;
  region?: string;
  address?: string;
  phone?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
}
