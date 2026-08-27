import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateConcernDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  actionTaken?: string;

  @ApiPropertyOptional({ description: 'true to resolve, false to reopen, omit to leave unchanged' })
  @IsOptional() @IsBoolean()
  resolved?: boolean;
}
