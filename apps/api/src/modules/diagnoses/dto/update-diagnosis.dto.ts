import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DiagnosisStatus, DiagnosisCertainty } from '@peditrack/database';

export class UpdateDiagnosisDto {
  @ApiPropertyOptional({ enum: DiagnosisStatus })
  @IsOptional() @IsEnum(DiagnosisStatus)
  status?: DiagnosisStatus;

  @ApiPropertyOptional({ enum: DiagnosisCertainty })
  @IsOptional() @IsEnum(DiagnosisCertainty)
  certainty?: DiagnosisCertainty;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Set explicitly, or omit to let status changes drive it' })
  @IsOptional() @IsDateString()
  resolvedDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  clinicalNote?: string;
}
