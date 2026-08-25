import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export enum GenderEnum { MALE = 'MALE', FEMALE = 'FEMALE', OTHER = 'OTHER' }

export enum BloodTypeEnum {
  A_POSITIVE = 'A_POSITIVE', A_NEGATIVE = 'A_NEGATIVE',
  B_POSITIVE = 'B_POSITIVE', B_NEGATIVE = 'B_NEGATIVE',
  AB_POSITIVE = 'AB_POSITIVE', AB_NEGATIVE = 'AB_NEGATIVE',
  O_POSITIVE = 'O_POSITIVE', O_NEGATIVE = 'O_NEGATIVE',
  UNKNOWN = 'UNKNOWN',
}

export class CreateGuardianDto {
  @ApiProperty({ example: 'Rosa' })
  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Dela Cruz' })
  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: 'Mother', description: 'Mother, Father, Grandparent, Legal Guardian...' })
  @IsString() @MaxLength(50)
  relationship!: string;

  @ApiProperty({ example: '+63 918 111 1111' })
  @IsString() @MinLength(7) @MaxLength(30)
  phone!: string;

  // SEC-023 fix: @IsEmail() ensures the value is a syntactically valid address.
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(120)
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  occupation?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isEmergencyContact?: boolean;
}

export class CreatePatientDto {
  @ApiProperty({ example: 'Liam' })
  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Dela Cruz' })
  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @ApiPropertyOptional({ example: 'Miguel' })
  @IsOptional() @IsString() @MaxLength(80)
  middleName?: string;

  @ApiProperty({ example: '2023-04-15', description: 'ISO date of birth' })
  @IsDateString({}, { message: 'dateOfBirth must be a valid ISO date' })
  dateOfBirth!: string;

  @ApiProperty({ enum: GenderEnum })
  @IsEnum(GenderEnum)
  gender!: GenderEnum;

  @ApiPropertyOptional({ enum: BloodTypeEnum, default: BloodTypeEnum.UNKNOWN })
  @IsOptional() @IsEnum(BloodTypeEnum)
  bloodType?: BloodTypeEnum;

  @ApiPropertyOptional({ example: 3.2, description: 'Birth weight in kilograms' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  birthWeightKg?: number;

  @ApiPropertyOptional({ example: 50, description: 'Birth length in centimetres' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  birthHeightCm?: number;

  @ApiPropertyOptional({ example: 39, description: 'Gestational age in weeks' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(20)
  gestationalAge?: number;

  // SEC-024 fix: cap each entry length and strip HTML tags so free-text fields
  // cannot carry XSS payloads into PDF exports, email templates, or any
  // non-React rendering context.
  @ApiPropertyOptional({ type: [String], example: ['Penicillin', 'Peanuts'] })
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((s: string) => s.replace(/<[^>]*>/g, '').trim()) : value,
  )
  allergies?: string[];

  @ApiPropertyOptional({ type: [String], example: ['Asthma'] })
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((s: string) => s.replace(/<[^>]*>/g, '').trim()) : value,
  )
  chronicConditions?: string[];

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : value))
  notes?: string;

  @ApiPropertyOptional({ type: [CreateGuardianDto], description: 'Guardians to create alongside the patient' })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateGuardianDto)
  guardians?: CreateGuardianDto[];
}
