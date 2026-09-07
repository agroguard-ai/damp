import { IsString } from 'class-validator';

export class UpdateFarmUserDto {
  @IsString()
  roleName: string;
}
