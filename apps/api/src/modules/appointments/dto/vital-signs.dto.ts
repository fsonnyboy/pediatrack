import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateVitalSignsDto {
  @ApiPropertyOptional({ example: 14.2, description: 'Weight in kilograms' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(200)
  weightKg?: number;

  @ApiPropertyOptional({ example: 95.5, description: 'Height in centimetres' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(250)
  heightCm?: number;

  @ApiPropertyOptional({ example: 48.0, description: 'Head circumference in cm' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(80)
  headCircumference?: number;

  @ApiPropertyOptional({ example: 37.2, description: 'Temperature in Celsius' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(25) @Max(45)
  temperatureC?: number;

  @ApiPropertyOptional({ example: 110, description: 'Heart rate in bpm' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(20) @Max(300)
  heartRate?: number;

  @ApiPropertyOptional({ example: 24, description: 'Breaths per minute' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(100)
  respiratoryRate?: number;

  @ApiPropertyOptional({ example: 98.5, description: 'SpO2 percentage' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  oxygenSaturation?: number;

  @ApiPropertyOptional({ example: 95 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(40) @Max(250)
  bloodPressureSys?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(20) @Max(200)
  bloodPressureDia?: number;
}
