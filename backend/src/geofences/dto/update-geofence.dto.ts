import { IsString, IsNotEmpty, IsArray, ArrayMinSize, IsOptional } from 'class-validator';

export class UpdateGeofenceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  pastureType?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  polygonCoordinates?: [number, number][];
}
