import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReferralDto {
  @ApiProperty({ example: 'Early Intervention', description: 'Where the patient was referred' })
  @IsString() @MaxLength(200)
  referredTo!: string;

  @ApiProperty({ example: '2026-08-27T10:00:00.000Z' })
  @IsDateString()
  referredAt!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  outcomeNote?: string;
}
