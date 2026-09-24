import { IsInt, IsOptional } from 'class-validator';

export class LinkAnimalCollarDto {
  @IsInt()
  @IsOptional()
  collarId?: number | null;
}
