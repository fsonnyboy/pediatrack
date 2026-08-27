import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class QueryDiagnosisCodesDto {
  @ApiPropertyOptional({ description: 'Free-text search — matches code, display name, or clinician search terms' })
  @IsOptional() @IsString() @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: 'Restrict to this clinic\'s pediatric short-list', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pediatricOnly?: boolean;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1) @Max(100)
  limit?: number;
}
