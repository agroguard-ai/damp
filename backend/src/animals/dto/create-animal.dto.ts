import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

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

  @IsString()
  @IsOptional()
  collarMacAddress?: string;
}
