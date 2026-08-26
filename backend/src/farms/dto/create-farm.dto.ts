import { IsString, IsNumber, IsOptional, Matches } from 'class-validator';

// Formato SENASA: XX.XXX.X.XXXXX/XX (Registro Nacional Sanitario de Productores Agropecuarios)
const RENSPA_FORMAT = /^\d{2}\.\d{3}\.\d\.\d{5}\/\d{2}$/;

export class CreateFarmDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  province: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsNumber()
  totalAreaHa: number;

  @IsOptional()
  polygonCoordinates?: any;

  @IsOptional()
  @IsString()
  @Matches(RENSPA_FORMAT, { message: 'RENSPA debe tener el formato XX.XXX.X.XXXXX/XX' })
  renspa?: string;
}
