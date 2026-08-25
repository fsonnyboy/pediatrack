import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@peditrack/types';

export const ROLES_KEY = 'roles';

/** Restrict a route to specific staff roles. Used with RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
