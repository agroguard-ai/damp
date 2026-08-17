import { IsNumber, IsInt, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class UpdateAlertSettingsDto {
  @IsNumber()
  @IsOptional()
  @Min(-10)
  @Max(60)
  feverThreshold?: number;

  @IsNumber()
  @IsOptional()
  @Min(-10)
  @Max(60)
  hypothermiaThreshold?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  inactivityMinutes?: number;

  @IsBoolean()
  @IsOptional()
  emailOnEscape?: boolean;

  @IsBoolean()
  @IsOptional()
  emailOnHealth?: boolean;
}
