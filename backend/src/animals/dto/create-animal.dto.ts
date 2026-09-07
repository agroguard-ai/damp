import { IsString, IsNumber, IsOptional, IsUUID, IsInt } from 'class-validator';

export class CreateAnimalDto {
  @IsUUID()
  farmId: string;

  @IsString()
  @IsOptional()
  tag?: string;

  @IsString()
  breed: string;

  @IsNumber()
  weightKg: number;

  @IsNumber()
  ageMonths: number;

  @IsInt()
  @IsOptional()
  collarId?: number;

  @IsUUID()
  @IsOptional()
  animalTypeId?: string;

  @IsUUID()
  @IsOptional()
  zoneId?: string;
}
