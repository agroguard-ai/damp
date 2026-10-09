import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCollarRequestDto {
  @IsString()
  @IsNotEmpty()
  farmId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestedCount: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
