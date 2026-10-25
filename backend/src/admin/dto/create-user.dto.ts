import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength, Min, IsInt } from 'class-validator';
import { GlobalRole } from '@generated/prisma';

export const ADMIN_CREATABLE_ROLES: GlobalRole[] = [GlobalRole.SUPER_ADMIN, GlobalRole.FARM_ADMIN];

export class CreateUserDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña inicial debe tener al menos 8 caracteres' })
  initialPassword?: string;

  // El super admin solo da de alta super admins y administradores de campos: los operadores y
  // lectores (USER) los crea cada administrador desde su gestión de personal.
  @IsOptional()
  @IsIn(ADMIN_CREATABLE_ROLES, { message: 'El rol debe ser SUPER_ADMIN o FARM_ADMIN' })
  globalRole?: GlobalRole;

  @IsOptional()
  @Min(0, { message: 'El cupo de collares no puede ser negativo' })
  maxCollars?: number;
}
