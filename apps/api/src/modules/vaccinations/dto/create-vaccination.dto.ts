import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateVaccinationDto {
  @ApiProperty({ description: 'Patient cuid' })
  @IsString()
  patientId!: string;

  @ApiProperty({ description: 'Vaccine cuid' })
  @IsString()
  vaccineId!: string;

  @ApiPropertyOptional({ description: 'Link to the visit this was given at' })
  @IsOptional() @IsString()
  appointmentId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  doseNumber?: number;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  @IsDateString()
  administeredAt!: string;

  @ApiPropertyOptional({ example: 'MMR-2026-C88' })
  @IsOptional() @IsString() @MaxLength(60)
  batchNumber?: string;

  @ApiPropertyOptional({ example: '2027-06-30' })
  @IsOptional() @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'Left deltoid' })
  @IsOptional() @IsString() @MaxLength(60)
  site?: string;

  @ApiPropertyOptional({ example: 'IM', description: 'IM, SC, ID, Oral' })
  @IsOptional() @IsString() @MaxLength(20)
  route?: string;

  @ApiPropertyOptional({ description: 'Overrides the auto-calculated next dose date' })
  @IsOptional() @IsDateString()
  nextDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  adverseReaction?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}
