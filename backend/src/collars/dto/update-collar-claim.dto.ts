import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CollarClaimStatus } from '@generated/prisma';

export class UpdateCollarClaimDto {
  @IsEnum(CollarClaimStatus)
  status: CollarClaimStatus;

  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}
