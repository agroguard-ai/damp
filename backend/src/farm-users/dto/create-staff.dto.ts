import { ArrayMinSize, IsArray, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { STAFF_ROLES, type StaffRoleName } from '@/auth/farm-roles';

export class CreateStaffDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña inicial debe tener al menos 8 caracteres' })
  initialPassword?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsIn(STAFF_ROLES, { message: `El rol debe ser uno de: ${STAFF_ROLES.join(', ')}` })
  roleName!: StaffRoleName;

  @IsArray()
  @ArrayMinSize(1, { message: 'Asigná al menos un campo' })
  @IsString({ each: true })
  farmIds!: string[];
}
