import { IsNumber, IsInt } from 'class-validator';

export class TelemetryPayloadDto {
  @IsInt()
  collar_id: number;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsNumber()
  temp: number;
}