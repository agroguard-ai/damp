import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateCollarDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  identifier?: string;
}
