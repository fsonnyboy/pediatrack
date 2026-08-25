import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export enum UserRoleEnum {
  ADMIN = 'ADMIN',
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  RECEPTIONIST = 'RECEPTIONIST',
}

export class CreateUserDto {
  @ApiProperty({ example: 'newdoctor@peditrack.app' })
  @IsEmail()
  email!: string;

  // SEC-026 / SEC-012 fix: @MaxLength(72) caps input at bcrypt's effective
  // key length, preventing CPU-exhaustion DoS from very long passwords.
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString() @MinLength(8) @MaxLength(72)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain an uppercase letter, a lowercase letter and a number',
  })
  password!: string;

  @ApiProperty({ enum: UserRoleEnum })
  @IsEnum(UserRoleEnum)
  role!: UserRoleEnum;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: 'PRC licence number, for doctors' })
  @IsOptional() @IsString() @MaxLength(50)
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'General Pediatrics' })
  @IsOptional() @IsString() @MaxLength(100)
  specialty?: string;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}
