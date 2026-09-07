import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateGatewayDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  zoneId?: string;
}
