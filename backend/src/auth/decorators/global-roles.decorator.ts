import { SetMetadata } from '@nestjs/common';
import { GlobalRole } from '@generated/prisma';

export const GLOBAL_ROLES_KEY = 'global_roles';

export const GlobalRoles = (...roles: GlobalRole[]) => SetMetadata(GLOBAL_ROLES_KEY, roles);
