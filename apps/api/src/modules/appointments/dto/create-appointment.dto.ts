import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export enum AppointmentTypeEnum {
  CHECKUP = 'CHECKUP',
  FOLLOW_UP = 'FOLLOW_UP',
  VACCINATION = 'VACCINATION',
  SICK_VISIT = 'SICK_VISIT',
  CONSULTATION = 'CONSULTATION',
  EMERGENCY = 'EMERGENCY',
}

export enum AppointmentStatusEnum {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Patient cuid' })
  @IsString()
  patientId!: string;

  @ApiProperty({ description: 'Attending doctor cuid' })
  @IsString()
  doctorId!: string;

  @ApiProperty({ example: '2026-09-01T09:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ default: 30, minimum: 5, maximum: 480 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(480)
  durationMinutes?: number;

  @ApiProperty({ enum: AppointmentTypeEnum })
  @IsEnum(AppointmentTypeEnum)
  type!: AppointmentTypeEnum;

  @ApiPropertyOptional({ example: 'Fever and cough for 2 days' })
  @IsOptional() @IsString() @MaxLength(500)
  chiefComplaint?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  reasonForVisit?: string;
}
