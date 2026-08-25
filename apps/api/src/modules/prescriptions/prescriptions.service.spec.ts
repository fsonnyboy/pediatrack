import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrescriptionsService } from './prescriptions.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = () => ({
  patient: { findFirst: jest.fn() },
  prescription: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
});

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let prisma: ReturnType<typeof mockPrisma>;

  const baseItem = {
    medicineName: 'Amoxicillin',
    dosage: '250mg/5ml',
    frequency: '3x daily',
    durationDays: 7,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        { provide: PrismaService, useFactory: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(PrescriptionsService);
    prisma = module.get(PrismaService);
  });

  it('rejects a prescription that conflicts with a recorded allergy', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: ['Amoxicillin'],
    });

    await expect(
      service.create({ patientId: 'p1', items: [baseItem] }, 'doc1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.prescription.create).not.toHaveBeenCalled();
  });

  it('matches an allergy against the generic name too', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: ['penicillin'],
    });

    await expect(
      service.create(
        {
          patientId: 'p1',
          items: [{ ...baseItem, medicineName: 'Amoxil', genericName: 'Penicillin derivative' }],
        },
        'doc1',
      ),
    ).rejects.toThrow(/penicillin/i);
  });

  it('issues the prescription when nothing conflicts', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: ['Peanuts'],
    });
    prisma.prescription.create.mockResolvedValue({ id: 'rx1', items: [baseItem] });

    const result = await service.create({ patientId: 'p1', items: [baseItem] }, 'doc1');

    expect(result.id).toBe('rx1');
    expect(prisma.prescription.create).toHaveBeenCalled();
  });

  it('refuses to re-close a prescription that is not active', async () => {
    prisma.prescription.findUnique.mockResolvedValue({ id: 'rx1', status: 'COMPLETED' });

    await expect(
      service.updateStatus('rx1', { status: 'CANCELLED' as never }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFound for an unknown patient', async () => {
    prisma.patient.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ patientId: 'nope', items: [baseItem] }, 'doc1'),
    ).rejects.toThrow(NotFoundException);
  });
});
