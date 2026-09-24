import { IsString, IsOptional, IsInt, Min, IsArray, ArrayMinSize, IsBoolean } from 'class-validator';

export class CreateZoneRotationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsInt()
  @Min(1, { message: 'La frecuencia de rotación debe ser de al menos 1 hora.' })
  frequencyHours: number;

  @IsArray({ message: 'Debe especificar una lista de cercos virtuales.' })
  @ArrayMinSize(2, {
    message: 'Se requieren al menos dos cercos virtuales dentro de la zona para poder configurar una rotación de pastoreo.',
  })
  @IsString({ each: true })
  geofenceIds: string[];

  @IsOptional()
  @IsBoolean()
  autoRotate?: boolean;
}
