import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DiagnosisStatus, DiagnosisCertainty } from '@peditrack/database';

export class CreateDiagnosisDto {
  @ApiProperty({ description: 'Patient cuid' })
  @IsString()
  patientId!: string;

  @ApiProperty({ description: 'DiagnosisCode cuid, from GET /diagnosis-codes' })
  @IsString()
  codeId!: string;

  @ApiPropertyOptional({ description: 'Link to the visit this was diagnosed at' })
  @IsOptional() @IsString()
  appointmentId?: string;

  @ApiPropertyOptional({ enum: DiagnosisStatus, default: 'ACTIVE' })
  @IsOptional() @IsEnum(DiagnosisStatus)
  status?: DiagnosisStatus;

  @ApiPropertyOptional({ enum: DiagnosisCertainty, default: 'CONFIRMED' })
  @IsOptional() @IsEnum(DiagnosisCertainty)
  certainty?: DiagnosisCertainty;

  @ApiPropertyOptional({ description: 'The diagnosis that drove this encounter', default: false })
  @IsOptional() @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  onsetDate?: string;

  @ApiPropertyOptional({ description: 'Nuance a code cannot carry — kept alongside the code, not instead of it' })
  @IsOptional() @IsString() @MaxLength(1000)
  clinicalNote?: string;
}
