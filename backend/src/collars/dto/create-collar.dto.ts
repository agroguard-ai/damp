import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCollarDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsOptional()
  farmId?: string;
}
