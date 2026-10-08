import { IsString, IsNotEmpty, IsOptional, IsInt, IsPositive } from 'class-validator';

export class UpdateCollarDto {
  @IsInt()
  @IsPositive()
  @IsOptional()
  id?: number;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  identifier?: string;

  @IsString()
  @IsOptional()
  farmId?: string | null;
}
