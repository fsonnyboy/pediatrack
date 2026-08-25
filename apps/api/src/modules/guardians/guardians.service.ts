import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGuardianDto, UpdateGuardianDto } from './dto/guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGuardianDto) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    // Only one guardian may be primary — promoting one demotes the rest.
    if (dto.isPrimary) await this.clearPrimary(dto.patientId);

    return this.prisma.guardian.create({ data: dto });
  }

  findByPatient(patientId: string) {
    return this.prisma.guardian.findMany({
      where: { patientId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const guardian = await this.prisma.guardian.findUnique({
      where: { id },
      include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } },
    });
    if (!guardian) throw new NotFoundException(`Guardian ${id} was not found`);
    return guardian;
  }

  async update(id: string, dto: UpdateGuardianDto) {
    const guardian = await this.findOne(id);
    if (dto.isPrimary) await this.clearPrimary(guardian.patientId, id);
    return this.prisma.guardian.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.guardian.delete({ where: { id } });
    return { message: 'Guardian removed' };
  }

  private clearPrimary(patientId: string, exceptId?: string) {
    return this.prisma.guardian.updateMany({
      where: { patientId, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isPrimary: false },
    });
  }
}
