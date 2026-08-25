import {
  IsOptional, IsString, IsIn, IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

import { PaginationDto } from '../../../common/dto/pagination.dto';

// SEC-010 fix: explicit allowlist of permitted sort columns for the Patient model.
// Using [sortBy] as a dynamic Prisma orderBy key with unconstrained user input lets
// an attacker order by sensitive fields (passwordHash) or trigger expensive JOINs on
// non-indexed relation fields.
export const PATIENT_SORT_FIELDS = [
  'createdAt', 'updatedAt', 'lastName', 'firstName', 'dateOfBirth', 'mrn',
] as const;
export type PatientSortField = (typeof PATIENT_SORT_FIELDS)[number];

enum GenderEnum { MALE = 'MALE', FEMALE = 'FEMALE' }
enum AgeGroupEnum {
  INFANT = 'infant', TODDLER = 'toddler', PRESCHOOL = 'preschool',
  SCHOOL = 'school', ADOLESCENT = 'adolescent',
}

export class QueryPatientsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Full-text search on first/last name and MRN' })
  @IsOptional() @IsString() @Transform(({ value }) => String(value ?? '').trim())
  search?: string;

  @ApiPropertyOptional({ enum: GenderEnum })
  @IsOptional() @IsEnum(GenderEnum)
  gender?: string;

  @ApiPropertyOptional({ enum: AgeGroupEnum })
  @IsOptional() @IsEnum(AgeGroupEnum)
  ageGroup?: string;

  // SEC-010 fix: constrained to the safe allowlist only.
  @ApiPropertyOptional({ enum: PATIENT_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(PATIENT_SORT_FIELDS, {
    message: `sortBy must be one of: ${PATIENT_SORT_FIELDS.join(', ')}`,
  })
  sortBy?: PatientSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional() @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
