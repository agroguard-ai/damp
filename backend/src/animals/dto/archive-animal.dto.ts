import { IsString, IsIn } from 'class-validator';

export class ArchiveAnimalDto {
  @IsString()
  @IsIn(['SOLD', 'DEAD'])
  status: string;
}
