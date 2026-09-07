import { IsString, IsEmail, IsOptional } from 'class-validator';

export class AssignFarmUserDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  roleName: string;
}
