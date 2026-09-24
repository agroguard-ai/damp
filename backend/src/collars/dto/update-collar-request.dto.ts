import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { CollarRequestStatus } from '@generated/prisma';

export class UpdateCollarRequestDto {
  @IsEnum(CollarRequestStatus)
  status: CollarRequestStatus;

  @IsString()
  @IsOptional()
  responseNotes?: string;

  /** Si es true y status == APPROVED, se incrementa automáticamente maxCollars del dueño de la granja */
  @IsBoolean()
  @IsOptional()
  incrementMaxCollars?: boolean;
}
