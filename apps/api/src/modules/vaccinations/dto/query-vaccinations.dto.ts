import { IsOptional, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryVaccinationsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  vaccineId?: string;

  @ApiPropertyOptional({ description: 'ISO date — administered-at range start' })
  @IsOptional() @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — administered-at range end' })
  @IsOptional() @IsDateString()
  to?: string;

  /**
   * SEC-020 fix: constrained due-soon window.
   * ?days=999999 previously triggered a full table scan + N+1 DoS.
   */
  @ApiPropertyOptional({
    description: 'Number of days ahead to look for due vaccinations (1–365)',
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
