import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ConcernSource, MilestoneDomain } from '@peditrack/database';

export class CreateConcernDto {
  @ApiProperty({ description: 'Patient cuid' })
  @IsString()
  patientId!: string;

  @ApiPropertyOptional({ description: 'Link to the visit this was raised at' })
  @IsOptional() @IsString()
  appointmentId?: string;

  @ApiProperty({ enum: ConcernSource })
  @IsEnum(ConcernSource)
  source!: ConcernSource;

  @ApiPropertyOptional({ enum: MilestoneDomain })
  @IsOptional() @IsEnum(MilestoneDomain)
  domain?: MilestoneDomain;

  @ApiProperty({ example: 'Not yet combining words; older sibling was at this age' })
  @IsString() @MaxLength(1000)
  description!: string;

  @ApiPropertyOptional({ example: 'Screening moved up from the 24-month checkpoint' })
  @IsOptional() @IsString() @MaxLength(500)
  actionTaken?: string;

  @ApiPropertyOptional({ description: 'Defaults to now if omitted' })
  @IsOptional() @IsDateString()
  raisedAt?: string;
}
