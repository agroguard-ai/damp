import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateFarmDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  province: string;

  @IsNumber()
  totalAreaHa: number;
}
