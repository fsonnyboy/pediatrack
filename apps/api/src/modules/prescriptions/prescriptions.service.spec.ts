import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrescriptionsService } from './prescriptions.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = () => ({
  patient: { findFirst: jest.fn() },
  prescription: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  vitalSign: { findFirst: jest.fn() },
  medicineDoseReference: { findMany: jest.fn().mockResolvedValue([]) },
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

  const AMOXICILLIN_REF = {
    genericName: 'Amoxicillin',
    mgPerKgDayMin: 25,
    mgPerKgDayMax: 45,
    maxSingleDoseMg: 1000,
    maxDailyDoseMg: 3000,
    source: 'BNF for Children',
    sourceVersion: '2024',
    isActive: true,
  };

  it('rejects a structured dose that falls outside the mg/kg/day reference range', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1', mrn: 'PT-2026-00001', allergies: [] });
    prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
    prisma.vitalSign.findFirst.mockResolvedValue({ weightKg: 10 });

    // 500mg x 3/day on a 10kg child = 150 mg/kg/day, far above the 25-45 range.
    await expect(
      service.create(
        { patientId: 'p1', items: [{ ...baseItem, doseAmountMg: 500, dosesPerDay: 3 }] },
        'doc1',
      ),
    ).rejects.toThrow(/outside the recommended/i);

    expect(prisma.prescription.create).not.toHaveBeenCalled();
  });

  it('rejects a structured dose when the patient has no recorded weight', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1', mrn: 'PT-2026-00001', allergies: [] });
    prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
    prisma.vitalSign.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        { patientId: 'p1', items: [{ ...baseItem, doseAmountMg: 250, dosesPerDay: 3 }] },
        'doc1',
      ),
    ).rejects.toThrow(/no recorded weight/i);
  });

  it('accepts a structured dose within the reference range', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1', mrn: 'PT-2026-00001', allergies: [] });
    prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
    prisma.vitalSign.findFirst.mockResolvedValue({ weightKg: 20 });
    prisma.prescription.create.mockResolvedValue({ id: 'rx1', items: [baseItem] });

    // 250mg x 3/day on a 20kg child = 37.5 mg/kg/day, inside 25-45.
    const result = await service.create(
      { patientId: 'p1', items: [{ ...baseItem, doseAmountMg: 250, dosesPerDay: 3 }] },
      'doc1',
    );

    expect(result.id).toBe('rx1');
  });

  it('skips the dose check when no structured dose is provided', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1', mrn: 'PT-2026-00001', allergies: [] });
    prisma.prescription.create.mockResolvedValue({ id: 'rx1', items: [baseItem] });

    const result = await service.create({ patientId: 'p1', items: [baseItem] }, 'doc1');

    expect(result.id).toBe('rx1');
    expect(prisma.medicineDoseReference.findMany).not.toHaveBeenCalled();
  });

  it('skips the dose check when the medicine has no reference entry', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1', mrn: 'PT-2026-00001', allergies: [] });
    prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
    prisma.prescription.create.mockResolvedValue({ id: 'rx1', items: [baseItem] });

    const result = await service.create(
      {
        patientId: 'p1',
        items: [{ ...baseItem, medicineName: 'Some Unlisted Drug', doseAmountMg: 999999, dosesPerDay: 3 }],
      },
      'doc1',
    );

    expect(result.id).toBe('rx1');
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
