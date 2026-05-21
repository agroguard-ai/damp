import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateFarmDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsNumber()
  @IsOptional()
  totalAreaHa?: number;
}
