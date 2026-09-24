import { IsString, IsNumber, IsOptional, IsUUID, IsInt } from 'class-validator';

export class UpdateAnimalDto {
  @IsString()
  @IsOptional()
  tag?: string;

  @IsString()
  @IsOptional()
  breed?: string;

  @IsNumber()
  @IsOptional()
  weightKg?: number;

  @IsNumber()
  @IsOptional()
  ageMonths?: number;

  @IsInt()
  @IsOptional()
  collarId?: number | null;

  @IsUUID()
  @IsOptional()
  animalTypeId?: string | null;

  @IsUUID()
  @IsOptional()
  zoneId?: string | null;
}

