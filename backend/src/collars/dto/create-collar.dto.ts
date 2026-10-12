import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateCollarDto {
  /** ID numérico único del collar (opcional; si no se provee, la DB autoincrementa) */
  @IsInt()
  @Min(1)
  @IsOptional()
  id?: number;

  /** Identificador visual o alfanumérico (opcional; si se omite, se genera como COLLAR-<id>) */
  @IsString()
  @IsOptional()
  identifier?: string;

  @IsString()
  @IsOptional()
  farmId?: string;
}

