import { IsInt, Min } from 'class-validator';

export class UpdateMaxCollarsDto {
  @IsInt()
  @Min(0, { message: 'El cupo de collares no puede ser negativo' })
  maxCollars!: number;
}
