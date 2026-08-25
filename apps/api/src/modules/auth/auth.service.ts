import {
  Injectable, UnauthorizedException, BadRequestException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { AuthUser, JwtPayload, LoginResponse, UserRole } from '@peditrack/types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, ip?: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    // Same message for "no such user" and "wrong password" so the endpoint
    // cannot be used to enumerate registered email addresses.
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: ip },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    };

    const expiresIn = this.parseExpiry(this.config.get<string>('JWT_EXPIRES_IN', '7d'));

    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn,
      user: this.toAuthUser(user),
    };
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');
    return this.toAuthUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current one');
    }

    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.newPassword, Number(rounds));

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    this.logger.log(`Password changed for user ${userId}`);

    return { message: 'Password updated successfully' };
  }

  async validateUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt) return null;
    return this.toAuthUser(user);
  }

  private toAuthUser(user: {
    id: string; email: string; role: string; firstName: string; lastName: string;
    phone: string | null; avatarUrl: string | null; specialty: string | null;
    licenseNumber: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      specialty: user.specialty,
      licenseNumber: user.licenseNumber,
    };
  }

  /** '7d' | '24h' | '60m' | '3600' -> seconds */
  private parseExpiry(value: string): number {
    const match = /^(\d+)([smhd])?$/.exec(value.trim());
    if (!match) return 604800;
    const n = Number(match[1]);
    const unit = match[2] ?? 's';
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (multipliers[unit] ?? 1);
  }
}
