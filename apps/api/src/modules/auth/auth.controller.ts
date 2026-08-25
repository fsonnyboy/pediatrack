import {
  Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';

import { AuthService } from './auth.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@peditrack/types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly blacklist: TokenBlacklistService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // SEC-004 fix: override the global 'default' throttler with the far stricter
  // 'auth' budget (5 attempts per 15 minutes) so brute-force attacks against
  // the login endpoint are blocked long before the global limit is reached.
  @Throttle({ auth: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Sets an HttpOnly auth cookie and returns the user profile' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 429, description: 'Too many login attempts — try again in 15 minutes' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, ip);

    // SEC-001 fix: issue the JWT as an HttpOnly, SameSite=Strict cookie so it
    // is never readable by JavaScript and cannot be stolen via XSS.
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie('peditrack_token', result.accessToken, {
      httpOnly: true,
      secure: isProd,           // HTTPS-only in production
      sameSite: 'strict',       // blocks cross-origin requests
      maxAge: result.expiresIn * 1000, // ms
      path: '/',
    });

    // Do not return the raw accessToken in the body — the client has no
    // legitimate reason to store it now that a cookie is set.
    const { accessToken: _token, ...safeResult } = result;
    return safeResult;
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  me(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Change your own password' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(user.id, dto);

    // SEC-002 fix: invalidate all previously issued tokens so any stolen or
    // cached token stops working the moment the password changes.
    this.blacklist.invalidateUser(user.id);
    this.clearAuthCookie(res);

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Log out — revokes the session token' })
  logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    // SEC-002 fix: mark the user's tokens as revoked from this moment forward.
    this.blacklist.invalidateUser(user.id);
    this.clearAuthCookie(res);
    return { message: 'Logged out successfully' };
  }

  /** Clears the auth cookie on the response (used by logout and password-change). */
  private clearAuthCookie(res: Response): void {
    res.clearCookie('peditrack_token', {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    });
  }
}
