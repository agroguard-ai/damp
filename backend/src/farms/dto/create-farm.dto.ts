import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateFarmDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  province: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsNumber()
  totalAreaHa: number;

  @IsOptional()
  polygonCoordinates?: any;
}
