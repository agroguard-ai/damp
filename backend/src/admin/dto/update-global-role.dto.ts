import { IsIn } from 'class-validator';
import { GlobalRole } from '@generated/prisma';
import { ADMIN_CREATABLE_ROLES } from './create-user.dto';

export class UpdateGlobalRoleDto {
  @IsIn(ADMIN_CREATABLE_ROLES, { message: 'El rol debe ser SUPER_ADMIN o FARM_ADMIN' })
  globalRole: GlobalRole;
}
