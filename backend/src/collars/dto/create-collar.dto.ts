import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCollarDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
