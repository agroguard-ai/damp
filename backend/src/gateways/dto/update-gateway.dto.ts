import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateGatewayDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  farmId?: string | null;

  @IsString()
  @IsOptional()
  zoneId?: string | null;
}

