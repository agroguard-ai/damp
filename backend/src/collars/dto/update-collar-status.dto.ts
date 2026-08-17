import { IsEnum } from 'class-validator';
import { CollarStatus } from '@generated/prisma';

export class UpdateCollarStatusDto {
  @IsEnum(CollarStatus)
  status: CollarStatus;
}
