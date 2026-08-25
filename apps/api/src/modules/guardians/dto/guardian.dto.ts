import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGuardianDto {
  @ApiProperty({ description: 'Patient this guardian belongs to' })
  @IsString()
  patientId!: string;

  @ApiProperty({ example: 'Rosa' })
  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Dela Cruz' })
  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: 'Mother' })
  @IsString() @MaxLength(50)
  relationship!: string;

  @ApiProperty({ example: '+63 918 111 1111' })
  @IsString() @MinLength(7) @MaxLength(30)
  phone!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  email?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  occupation?: string;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  isEmergencyContact?: boolean;
}

export class UpdateGuardianDto extends PartialType(
  OmitType(CreateGuardianDto, ['patientId'] as const),
) {}
