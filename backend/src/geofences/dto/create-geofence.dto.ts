import { IsString, IsNotEmpty, IsArray, ArrayMinSize, IsOptional } from 'class-validator';

export class CreateGeofenceDto {
  @IsString()
  @IsNotEmpty()
  farmId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  pastureType?: string;

  @IsArray()
  @ArrayMinSize(3)
  polygonCoordinates: [number, number][];

  @IsArray()
  animalIds: string[];
}
