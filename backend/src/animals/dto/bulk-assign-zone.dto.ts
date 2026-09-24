import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class BulkAssignZoneDto {
  @IsUUID()
  farmId: string;

  @IsArray()
  @IsString({ each: true })
  animalIds: string[];

  @IsUUID()
  @IsOptional()
  zoneId?: string | null;
}
