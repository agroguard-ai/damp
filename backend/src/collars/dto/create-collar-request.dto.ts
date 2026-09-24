import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';

export class CreateCollarRequestDto {
  @IsString()
  @IsNotEmpty()
  farmId: string;

  @IsInt()
  @Min(1)
  requestedCount: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
