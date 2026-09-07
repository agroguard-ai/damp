import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateAnimalTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  species: string;

  @IsOptional()
  @IsString()
  description?: string;
}
