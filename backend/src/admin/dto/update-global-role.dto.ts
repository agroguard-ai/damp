import { IsEnum } from 'class-validator';
import { GlobalRole } from '@generated/prisma';

export class UpdateGlobalRoleDto {
  @IsEnum(GlobalRole)
  globalRole: GlobalRole;
}
