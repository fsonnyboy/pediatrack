import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

/** The twelve CDC checklist ages, 2 months through 5 years. */
export const MILESTONE_CHECKLIST_AGES = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60] as const;

export class QueryMilestoneDefinitionsDto {
  @ApiPropertyOptional({ enum: MILESTONE_CHECKLIST_AGES, description: 'Filter to one checklist age' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(MILESTONE_CHECKLIST_AGES)
  ageMonths?: number;
}
