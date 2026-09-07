import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { MedicalEventType } from '@generated/prisma';

export class CreateMedicalEventDto {
  @IsString()
  @IsNotEmpty()
  animalId: string;

  @IsEnum(MedicalEventType)
  type: MedicalEventType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsDateString()
  @IsOptional()
  occurredAt?: string;
}
