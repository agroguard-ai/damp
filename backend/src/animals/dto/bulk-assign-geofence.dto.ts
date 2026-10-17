import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class BulkAssignGeofenceDto {
  @IsUUID()
  farmId: string;

  @IsArray()
  @IsString({ each: true })
  animalIds: string[];

  @IsUUID()
  @IsOptional()
  geofenceId?: string | null;
}
