import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ScreeningOutcome } from '@peditrack/database';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryScreeningsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  instrumentId?: string;

  @ApiPropertyOptional({ enum: ScreeningOutcome })
  @IsOptional() @IsEnum(ScreeningOutcome)
  outcome?: ScreeningOutcome;

  @ApiPropertyOptional({ description: 'ISO date — administered-at range start' })
  @IsOptional() @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — administered-at range end' })
  @IsOptional() @IsDateString()
  to?: string;
}

/**
 * Query DTO for GET /screenings/due-soon.
 *
 * Bounded window, same pattern as vaccinations' SEC-020 fix: an unbounded
 * `days` value would force dueSoon() to scan a much wider patient set than
 * the 36-month screening population it's meant to cover.
 */
export class DueSoonQueryDto {
  @ApiPropertyOptional({
    description: 'Number of days ahead to look for due screenings (1–365)',
    minimum: 1,
    maximum: 365,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'days must be at least 1' })
  @Max(365, { message: 'days cannot exceed 365' })
  days?: number;
}
