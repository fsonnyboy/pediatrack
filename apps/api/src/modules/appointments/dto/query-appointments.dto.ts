import {
  IsOptional, IsString, IsIn, IsEnum, IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

import { AppointmentStatus, AppointmentType } from '@peditrack/database';

import { PaginationDto } from '../../../common/dto/pagination.dto';

// SEC-010 fix: explicit allowlist of permitted sort columns for the Appointment model.
export const APPOINTMENT_SORT_FIELDS = [
  'scheduledAt', 'createdAt', 'updatedAt', 'status', 'type',
] as const;
export type AppointmentSortField = (typeof APPOINTMENT_SORT_FIELDS)[number];

enum AppointmentStatusEnum {
  PENDING = 'PENDING', CONFIRMED = 'CONFIRMED', IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED', CANCELLED = 'CANCELLED', NO_SHOW = 'NO_SHOW',
}
enum AppointmentTypeEnum {
  CHECKUP = 'CHECKUP', SICK_VISIT = 'SICK_VISIT', VACCINATION = 'VACCINATION',
  FOLLOW_UP = 'FOLLOW_UP', CONSULTATION = 'CONSULTATION',
}

export class QueryAppointmentsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AppointmentStatusEnum })
  @IsOptional() @IsEnum(AppointmentStatusEnum)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ enum: AppointmentTypeEnum })
  @IsOptional() @IsEnum(AppointmentTypeEnum)
  type?: AppointmentType;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'ISO date — start of range (inclusive)' })
  @IsOptional() @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — end of range (inclusive, end of day)' })
  @IsOptional() @IsDateString()
  to?: string;

  // SEC-010 fix: allowlisted sort columns only.
  @ApiPropertyOptional({ enum: APPOINTMENT_SORT_FIELDS, default: 'scheduledAt' })
  @IsOptional()
  @IsIn(APPOINTMENT_SORT_FIELDS, {
    message: `sortBy must be one of: ${APPOINTMENT_SORT_FIELDS.join(', ')}`,
  })
  sortBy?: AppointmentSortField = undefined;

  // sortOrder is inherited from PaginationDto (already @IsEnum-validated there).
  // Redeclaring it here added nothing and conflicted with the base type.
}
