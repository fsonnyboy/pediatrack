import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { AuthService } from '../auth.service';
import { TokenBlacklistService } from '../token-blacklist.service';
import type { AuthUser, JwtPayload } from '@peditrack/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authService: AuthService,
    private readonly blacklist: TokenBlacklistService,
    config: ConfigService,
  ) {
    super({
      // SEC-001 fix: prefer the HttpOnly cookie; fall back to Bearer header so
      // Swagger / API testing clients still work during development.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['peditrack_token'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
      passReqToCallback: false,
    });
  }

  /** Re-reads the user on every request so deactivated accounts lose access immediately. */
  async validate(payload: JwtPayload & { iat?: number }): Promise<AuthUser> {
    // SEC-002 fix: reject tokens that were issued before this user's last
    // logout / password-change event.
    if (this.blacklist.isRevoked(payload.sub, payload.iat ?? 0)) {
      throw new UnauthorizedException('Token has been revoked — please log in again');
    }

    const user = await this.authService.validateUser(payload.sub);
    if (!user) throw new UnauthorizedException('Session is no longer valid');
    return user;
  }
}
