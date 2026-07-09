import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class TelemetryPayloadDto {
  @IsString()
  @IsNotEmpty()
  mac_id: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsNumber()
  temp: number;

  @IsNumber()
  battery: number;
}
