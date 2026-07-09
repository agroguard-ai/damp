import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  pastureType?: string;

  @IsString()
  @IsNotEmpty()
  farmId: string;

  @IsOptional()
  @IsArray()
  polygonCoordinates?: any[];
}
