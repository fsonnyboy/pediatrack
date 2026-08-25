import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

/** Never select passwordHash — it must not leave the service layer. */
const SAFE_FIELDS = {
  id: true, email: true, role: true, firstName: true, lastName: true,
  phone: true, avatarUrl: true, licenseNumber: true, specialty: true,
  isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateUserDto) {
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', 12));
    const { password, ...rest } = dto;

    return this.prisma.user.create({
      data: {
        ...rest,
        email: dto.email.toLowerCase().trim(),
        passwordHash: await bcrypt.hash(password, rounds),
      },
      select: SAFE_FIELDS,
    });
  }

  findAll(role?: string) {
    return this.prisma.user.findMany({
      where: { deletedAt: null, ...(role ? { role: role as never } : {}) },
      select: SAFE_FIELDS,
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
  }

  /** Doctors available to be assigned to appointments. */
  listDoctors() {
    return this.prisma.user.findMany({
      where: { role: 'DOCTOR', isActive: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, specialty: true, licenseNumber: true },
      orderBy: { lastName: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: SAFE_FIELDS,
    });
    if (!user) throw new NotFoundException(`User ${id} was not found`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { ...dto, ...(dto.email ? { email: dto.email.toLowerCase().trim() } : {}) },
      select: SAFE_FIELDS,
    });
  }

  /** Deactivate rather than delete — clinical records reference the author. */
  async deactivate(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
      select: SAFE_FIELDS,
    });
  }
}
