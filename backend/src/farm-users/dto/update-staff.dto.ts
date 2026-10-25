import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { STAFF_ROLES, type StaffRoleName } from '@/auth/farm-roles';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío' })
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsIn(STAFF_ROLES, { message: `El rol debe ser uno de: ${STAFF_ROLES.join(', ')}` })
  roleName?: StaffRoleName;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Asigná al menos un campo' })
  @IsString({ each: true })
  farmIds?: string[];
}
