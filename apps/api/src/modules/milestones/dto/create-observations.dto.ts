import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator';
import { MilestoneStatus, ObservationSource } from '@peditrack/database';

class ObservationItemDto {
  @ApiProperty({ description: 'MilestoneDefinition cuid' })
  @IsString()
  definitionId!: string;

  @ApiProperty({ enum: MilestoneStatus })
  @IsEnum(MilestoneStatus)
  status!: MilestoneStatus;

  @ApiPropertyOptional({ enum: ObservationSource, default: 'CLINICIAN_OBSERVED' })
  @IsOptional() @IsEnum(ObservationSource)
  source?: ObservationSource;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

/**
 * A checklist pass at one visit. `items` should only include milestones the
 * clinician actually assessed — anything left off stays unrecorded rather
 * than defaulting to achieved, which is the whole point of NOT_ASSESSED
 * existing as a status instead of a bare boolean.
 */
export class CreateMilestoneObservationsDto {
  @ApiProperty({ description: 'Patient cuid' })
  @IsString()
  patientId!: string;

  @ApiPropertyOptional({ description: 'Link to the visit this checklist was completed at' })
  @IsOptional() @IsString()
  appointmentId?: string;

  @ApiProperty({ example: '2026-08-23T10:00:00.000Z' })
  @IsDateString()
  observedAt!: string;

  @ApiProperty({ type: [ObservationItemDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => ObservationItemDto)
  items!: ObservationItemDto[];
}
