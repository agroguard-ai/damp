import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, Min, IsInt } from 'class-validator';
import { GlobalRole } from '@generated/prisma';

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

  @IsOptional()
  @IsEnum(GlobalRole, { message: 'Rol global no válido' })
  globalRole?: GlobalRole;

  @IsOptional()
  @Min(0, { message: 'El cupo de collares no puede ser negativo' })
  maxCollars?: number;
}
