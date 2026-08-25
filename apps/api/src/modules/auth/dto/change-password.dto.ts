import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  // SEC-012 fix: cap currentPassword too so an attacker cannot send a huge
  // payload to trigger a bcrypt compare against an intentionally long string.
  @ApiProperty({ maxLength: 72 })
  @IsString() @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password must be at most 72 characters' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain an uppercase letter, a lowercase letter and a number',
  })
  newPassword!: string;
}
