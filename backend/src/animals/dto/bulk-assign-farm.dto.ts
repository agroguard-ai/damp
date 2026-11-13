import { IsArray, IsString, IsUUID } from 'class-validator';

export class BulkAssignFarmDto {
  @IsUUID()
  targetFarmId: string;

  @IsArray()
  @IsString({ each: true })
  animalIds: string[];
}
