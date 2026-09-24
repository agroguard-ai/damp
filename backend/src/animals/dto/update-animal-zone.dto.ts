import { IsOptional, IsUUID } from 'class-validator';

export class UpdateAnimalZoneDto {
  @IsUUID()
  @IsOptional()
  zoneId?: string | null;
}
