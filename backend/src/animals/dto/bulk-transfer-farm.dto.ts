import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class BulkTransferFarmDto {
  @IsUUID()
  sourceFarmId: string;

  @IsUUID()
  targetFarmId: string;

  @IsArray()
  @IsString({ each: true })
  animalIds: string[];

  @IsUUID()
  @IsOptional()
  farmId?: string;
}
