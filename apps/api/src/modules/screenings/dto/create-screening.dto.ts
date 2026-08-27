import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';
import { ScreeningOutcome } from '@peditrack/database';

/** The four AAP periodicity checkpoints before 36 months. */
const SCHEDULED_AGE_MONTHS = [9, 18, 24, 30] as const;

export class CreateScreeningDto {
  @ApiProperty({ description: 'Patient cuid' })
  @IsString()
  patientId!: string;

  @ApiProperty({ description: 'ScreeningInstrument cuid' })
  @IsString()
  instrumentId!: string;

  @ApiPropertyOptional({ description: 'Link to the visit this was administered at' })
  @IsOptional() @IsString()
  appointmentId?: string;

  @ApiProperty({ enum: SCHEDULED_AGE_MONTHS, description: 'Which periodicity checkpoint this screening fulfils' })
  @Type(() => Number) @IsInt() @IsIn(SCHEDULED_AGE_MONTHS)
  scheduledAgeMonths!: number;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  @IsDateString()
  administeredAt!: string;

  @ApiPropertyOptional({ description: 'Total score as computed by the clinician from the instrument' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  totalScore?: number;

  @ApiPropertyOptional({ description: 'Per-domain scores, e.g. { "communication": 45, "grossMotor": 30 }' })
  @IsOptional() @IsObject()
  domainScores?: Record<string, number>;

  @ApiProperty({ enum: ScreeningOutcome })
  @IsEnum(ScreeningOutcome)
  outcome!: ScreeningOutcome;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  concernNote?: string;
}
