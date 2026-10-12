import { IsString, IsEmail, IsOptional, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { FARM_ROLES, type FarmRoleName } from '@/auth/farm-roles';

export class AssignFarmUserDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsIn(FARM_ROLES, { message: `El rol debe ser uno de: ${FARM_ROLES.join(', ')}` })
  roleName: FarmRoleName;
}
