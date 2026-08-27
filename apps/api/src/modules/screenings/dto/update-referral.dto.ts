import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReferralStatus } from '@peditrack/database';

export class UpdateReferralDto {
  @ApiProperty({ enum: ReferralStatus })
  @IsEnum(ReferralStatus)
  status!: ReferralStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  outcomeNote?: string;
}
