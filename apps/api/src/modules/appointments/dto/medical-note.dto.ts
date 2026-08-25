import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** SOAP-format clinical note. `content` is required; the S/O/A/P fields are optional detail. */
export class CreateMedicalNoteDto {
  @ApiProperty({ description: 'Full note text' })
  @IsString() @MinLength(1) @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({ description: 'Subjective — what the parent or child reports' })
  @IsOptional() @IsString() @MaxLength(5000)
  subjective?: string;

  @ApiPropertyOptional({ description: 'Objective — exam findings and measurements' })
  @IsOptional() @IsString() @MaxLength(5000)
  objective?: string;

  @ApiPropertyOptional({ description: 'Assessment — diagnosis or impression' })
  @IsOptional() @IsString() @MaxLength(5000)
  assessment?: string;

  @ApiPropertyOptional({ description: 'Plan — treatment and follow-up' })
  @IsOptional() @IsString() @MaxLength(5000)
  plan?: string;
}
