import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentTypeEnum } from './dto/create-appointment.dto';

const mockPrisma = () => ({
  patient: { findFirst: jest.fn() },
  user: { findFirst: jest.fn() },
  appointment: {
    create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
    update: jest.fn(), count: jest.fn(),
  },
  vitalSign: { upsert: jest.fn() },
  $transaction: jest.fn(),
});

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: ReturnType<typeof mockPrisma>;

  const dto = {
    patientId: 'p1',
    doctorId: 'd1',
    scheduledAt: '2026-09-01T09:00:00.000Z',
    durationMinutes: 30,
    type: AppointmentTypeEnum.CHECKUP,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppointmentsService, { provide: PrismaService, useFactory: mockPrisma }],
    }).compile();

    service = module.get(AppointmentsService);
    prisma = module.get(PrismaService);

    prisma.patient.findFirst.mockResolvedValue({ id: 'p1', mrn: 'PT-2026-00001' });
    prisma.user.findFirst.mockResolvedValue({ id: 'd1' });
  });

  it('books when the doctor has a free slot', async () => {
    prisma.appointment.findMany.mockResolvedValue([]);
    prisma.appointment.create.mockResolvedValue({ id: 'a1' });

    const result = await service.create(dto);
    expect(result.id).toBe('a1');
  });

  it('rejects a booking that overlaps an existing appointment', async () => {
    // Existing 09:15–09:45 clashes with the requested 09:00–09:30
    prisma.appointment.findMany.mockResolvedValue([
      { id: 'a0', scheduledAt: new Date('2026-09-01T09:15:00.000Z'), durationMinutes: 30 },
    ]);

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('allows a booking that starts exactly when the previous one ends', async () => {
    prisma.appointment.findMany.mockResolvedValue([
      { id: 'a0', scheduledAt: new Date('2026-09-01T08:30:00.000Z'), durationMinutes: 30 },
    ]);
    prisma.appointment.create.mockResolvedValue({ id: 'a2' });

    await expect(service.create(dto)).resolves.toEqual({ id: 'a2' });
  });

  it('stamps completedAt when the visit is marked complete', async () => {
    prisma.appointment.findUnique.mockResolvedValue({ id: 'a1', status: 'IN_PROGRESS' });
    prisma.appointment.update.mockResolvedValue({ id: 'a1', status: 'COMPLETED' });

    await service.updateStatus('a1', { status: 'COMPLETED' as never });

    expect(prisma.appointment.update.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
  });

  it('computes BMI when recording weight and height', async () => {
    prisma.appointment.findUnique.mockResolvedValue({ id: 'a1', patientId: 'p1' });
    prisma.vitalSign.upsert.mockResolvedValue({ id: 'v1' });

    await service.recordVitals('a1', { weightKg: 16, heightCm: 100 }, 'n1');

    // 16 / (1.0 ^ 2) = 16.0
    expect(prisma.vitalSign.upsert.mock.calls[0][0].create.bmi).toBe(16);
  });

  it('throws NotFound for an unknown patient', async () => {
    prisma.patient.findFirst.mockResolvedValue(null);
    await expect(service.create(dto)).rejects.toThrow(NotFoundException);
  });
});
