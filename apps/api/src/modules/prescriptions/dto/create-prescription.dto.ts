import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export enum PrescriptionStatusEnum {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreatePrescriptionItemDto {
  @ApiProperty({ example: 'Amoxicillin' })
  @IsString() @MinLength(1) @MaxLength(150)
  medicineName!: string;

  @ApiPropertyOptional({ example: 'Amoxicillin trihydrate' })
  @IsOptional() @IsString() @MaxLength(150)
  genericName?: string;

  @ApiProperty({ example: '250mg/5ml' })
  @IsString() @MaxLength(60)
  dosage!: string;

  @ApiPropertyOptional({ example: 'Syrup', description: 'Syrup, Tablet, Drops, Suspension' })
  @IsOptional() @IsString() @MaxLength(40)
  form?: string;

  @ApiProperty({ example: '3x daily' })
  @IsString() @MaxLength(60)
  frequency!: string;

  @ApiProperty({ example: 7, minimum: 1 })
  @Type(() => Number) @IsInt() @Min(1)
  durationDays!: number;

  @ApiPropertyOptional({ example: '1 bottle (60ml)' })
  @IsOptional() @IsString() @MaxLength(60)
  quantity?: string;

  @ApiPropertyOptional({ example: 'Take after meals. Shake well before use.' })
  @IsOptional() @IsString() @MaxLength(500)
  instructions?: string;

  @ApiPropertyOptional({
    example: 250,
    description:
      'Amount of one dose, in mg. Provide this and dosesPerDay to run the weight-based dose check ' +
      'against the medicine reference range — without both, dosage is not machine-checkable.',
  })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01)
  doseAmountMg?: number;

  @ApiPropertyOptional({ example: 3, description: 'Number of doses per day, e.g. 3 for "3x daily"' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24)
  dosesPerDay?: number;
}

export class CreatePrescriptionDto {
  @ApiProperty({ description: 'Patient cuid' })
  @IsString()
  patientId!: string;

  @ApiPropertyOptional({ description: 'Visit this prescription belongs to' })
  @IsOptional() @IsString()
  appointmentId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Prescription expiry date' })
  @IsOptional() @IsDateString()
  validUntil?: string;

  @ApiProperty({ type: [CreatePrescriptionItemDto], description: 'At least one medicine' })
  @IsArray() @ArrayMinSize(1, { message: 'A prescription needs at least one medicine' })
  @ValidateNested({ each: true }) @Type(() => CreatePrescriptionItemDto)
  items!: CreatePrescriptionItemDto[];
}

export class UpdatePrescriptionStatusDto {
  @ApiProperty({ enum: PrescriptionStatusEnum })
  @IsEnum(PrescriptionStatusEnum)
  status!: PrescriptionStatusEnum;
}
