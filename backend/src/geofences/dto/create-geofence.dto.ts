import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class CreateGeofenceDto {
  @IsString()
  @IsNotEmpty()
  zoneId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ArrayMinSize(3)
  polygonCoordinates: [number, number][];

  @IsArray()
  animalIds: string[];
}
