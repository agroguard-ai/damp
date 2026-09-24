import { IsOptional, IsUUID } from 'class-validator';

export class AssignAnimalGeofenceDto {
  @IsUUID()
  @IsOptional()
  geofenceId?: string | null;
}
