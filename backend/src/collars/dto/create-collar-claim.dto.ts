import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateCollarClaimDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  description?: string;

  /** Si es true, además marca el collar inmediatamente como DAMAGED y libera al animal asignado */
  @IsBoolean()
  @IsOptional()
  markAsDamaged?: boolean;
}
