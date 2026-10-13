import { IsInt, Min, IsOptional } from 'class-validator';

export class PostponeRotationDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'La cantidad de horas a posponer debe ser al menos 1.' })
  hours?: number = 1;
}
