import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrescriptionsService } from './prescriptions.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = () => {
  const prisma: any = {
    patient: { findFirst: jest.fn() },
    prescription: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    prescriptionItem: { deleteMany: jest.fn() },
    vitalSign: { findFirst: jest.fn() },
    medicineDoseReference: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1),
    },
  };
  // Runs the callback against the same mock so tx.prescription.update etc.
  // are the exact jest.fn()s the test configured on `prisma`.
  prisma.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(prisma));
  return prisma;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
};

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let prisma: ReturnType<typeof mockPrisma>;

  // A 5-year-old, well outside the infant staleness window, unless a test overrides it.
  const NON_INFANT_DOB = monthsAgo(60);

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
      id: 'p1', mrn: 'PT-2026-00001', allergies: ['Amoxicillin'], dateOfBirth: NON_INFANT_DOB,
    });

    await expect(
      service.create({ patientId: 'p1', items: [baseItem] }, 'doc1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.prescription.create).not.toHaveBeenCalled();
  });

  it('matches an allergy against the generic name too', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: ['penicillin'], dateOfBirth: NON_INFANT_DOB,
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
      id: 'p1', mrn: 'PT-2026-00001', allergies: ['Peanuts'], dateOfBirth: NON_INFANT_DOB,
    });
    prisma.prescription.create.mockResolvedValue({ id: 'rx1', items: [baseItem] });

    const result = await service.create({ patientId: 'p1', items: [baseItem] }, 'doc1');

    expect(result.id).toBe('rx1');
    expect(prisma.prescription.create).toHaveBeenCalled();
  });

  const AMOXICILLIN_REF = {
    genericName: 'amoxicillin',
    aliases: [] as string[],
    ageMinMonths: null as number | null,
    ageMaxMonths: null as number | null,
    indication: null as string | null,
    mgPerKgDayMin: 25,
    mgPerKgDayMax: 45,
    maxSingleDoseMg: 1000,
    maxDailyDoseMg: 3000,
    source: 'BNF for Children',
    sourceVersion: '2024',
    isActive: true,
  };

  it('rejects a structured dose that falls outside the mg/kg/day reference range', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: NON_INFANT_DOB,
    });
    prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
    prisma.vitalSign.findFirst.mockResolvedValue({ weightKg: 10, recordedAt: daysAgo(1) });

    // 500mg x 3/day on a 10kg child = 150 mg/kg/day, far above the 25-45 range.
    await expect(
      service.create(
        {
          patientId: 'p1',
          items: [{ ...baseItem, dosage: '500mg/5ml', doseAmountMg: 500, dosesPerDay: 3 }],
        },
        'doc1',
      ),
    ).rejects.toThrow(/outside the recommended/i);

    expect(prisma.prescription.create).not.toHaveBeenCalled();
  });

  it('rejects a structured dose when the patient has no recorded weight', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: NON_INFANT_DOB,
    });
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
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: NON_INFANT_DOB,
    });
    prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
    prisma.vitalSign.findFirst.mockResolvedValue({ weightKg: 20, recordedAt: daysAgo(1) });
    prisma.prescription.create.mockResolvedValue({ id: 'rx1', items: [baseItem] });

    // 250mg x 3/day on a 20kg child = 37.5 mg/kg/day, inside 25-45.
    const result = await service.create(
      { patientId: 'p1', items: [{ ...baseItem, doseAmountMg: 250, dosesPerDay: 3 }] },
      'doc1',
    );

    expect(result.id).toBe('rx1');
  });

  it('skips the dose check when no structured dose is provided', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: NON_INFANT_DOB,
    });
    prisma.prescription.create.mockResolvedValue({ id: 'rx1', items: [baseItem] });

    const result = await service.create({ patientId: 'p1', items: [baseItem] }, 'doc1');

    expect(result.id).toBe('rx1');
    expect(prisma.medicineDoseReference.findMany).not.toHaveBeenCalled();
  });

  it('skips the dose check when the medicine has no reference entry', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: NON_INFANT_DOB,
    });
    prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
    prisma.prescription.create.mockResolvedValue({ id: 'rx1', items: [baseItem] });

    const result = await service.create(
      {
        patientId: 'p1',
        items: [{
          ...baseItem,
          medicineName: 'Some Unlisted Drug',
          dosage: '999999mg', // matches doseAmountMg below, so this isolates the "no reference" path
          doseAmountMg: 999999,
          dosesPerDay: 3,
        }],
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

  // ── D1: weight staleness ──────────────────────────────────────────

  it('rejects a dose computed from a weight recorded too long ago for an older child', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: NON_INFANT_DOB,
    });
    prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
    prisma.vitalSign.findFirst.mockResolvedValue({ weightKg: 20, recordedAt: daysAgo(120) });

    await expect(
      service.create(
        { patientId: 'p1', items: [{ ...baseItem, doseAmountMg: 250, dosesPerDay: 3 }] },
        'doc1',
      ),
    ).rejects.toThrow(/days old/i);
  });

  it('applies the tighter infant staleness window even when a weight would be fresh enough for an older child', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: monthsAgo(2),
    });
    prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
    // 45 days: stale for a 2-month-old (30-day window) though it would pass the 90-day window.
    prisma.vitalSign.findFirst.mockResolvedValue({ weightKg: 5, recordedAt: daysAgo(45) });

    await expect(
      service.create(
        { patientId: 'p1', items: [{ ...baseItem, doseAmountMg: 30, dosesPerDay: 3 }] },
        'doc1',
      ),
    ).rejects.toThrow(/days old/i);
  });

  // ── D2: printed dosage vs structured dose ───────────────────────────

  it('rejects a prescription where the printed dosage and the structured dose disagree', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: NON_INFANT_DOB,
    });

    await expect(
      service.create(
        {
          patientId: 'p1',
          // dosage says 250mg, doseAmountMg says 500 — a clinician reading the
          // label and the checked value would see two different numbers.
          items: [{ ...baseItem, dosage: '250mg/5ml', doseAmountMg: 500 }],
        },
        'doc1',
      ),
    ).rejects.toThrow(/these must match/i);
  });

  // ── D4: normalized / alias matching ─────────────────────────────────

  it('matches a reference row despite a salt suffix the item name carries', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: NON_INFANT_DOB,
    });
    prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
    prisma.vitalSign.findFirst.mockResolvedValue({ weightKg: 10, recordedAt: daysAgo(1) });

    // 500mg x 3/day on 10kg = 150 mg/kg/day — well outside range, so this only
    // throws if "Amoxicillin trihydrate" actually resolved to the "amoxicillin" row.
    await expect(
      service.create(
        {
          patientId: 'p1',
          items: [{
            ...baseItem,
            genericName: 'Amoxicillin trihydrate',
            dosage: '500mg/5ml',
            doseAmountMg: 500,
            dosesPerDay: 3,
          }],
        },
        'doc1',
      ),
    ).rejects.toThrow(/outside the recommended/i);
  });

  it('matches a reference row via an alias', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: NON_INFANT_DOB,
    });
    prisma.medicineDoseReference.findMany.mockResolvedValue([
      { ...AMOXICILLIN_REF, aliases: ['amoxil'] },
    ]);
    prisma.vitalSign.findFirst.mockResolvedValue({ weightKg: 10, recordedAt: daysAgo(1) });

    await expect(
      service.create(
        {
          patientId: 'p1',
          items: [{
            ...baseItem,
            medicineName: 'Amoxil',
            dosage: '500mg/5ml',
            doseAmountMg: 500,
            dosesPerDay: 3,
          }],
        },
        'doc1',
      ),
    ).rejects.toThrow(/outside the recommended/i);
  });

  // ── D5: age-banded reference rows ───────────────────────────────────

  it('prefers a narrower age-banded row over the general fallback for the patient it covers', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      // 20-day-old neonate.
      id: 'p1', mrn: 'PT-2026-00001', allergies: [], dateOfBirth: daysAgo(20),
    });
    prisma.medicineDoseReference.findMany.mockResolvedValue([
      { ...AMOXICILLIN_REF, mgPerKgDayMin: 25, mgPerKgDayMax: 45 }, // general fallback
      {
        ...AMOXICILLIN_REF,
        ageMinMonths: 0, ageMaxMonths: 1,
        mgPerKgDayMin: 10, mgPerKgDayMax: 15, // much lower neonatal range
      },
    ]);
    prisma.vitalSign.findFirst.mockResolvedValue({ weightKg: 4, recordedAt: daysAgo(1) });

    // 20mg x 3/day on 4kg = 15 mg/kg/day — inside the general 25-45 band's
    // "too low" side is irrelevant; what matters is it's at the *top* of the
    // neonatal band, so only the neonatal row's bounds can make this pass.
    prisma.prescription.create.mockResolvedValue({ id: 'rx1' });
    const result = await service.create(
      {
        patientId: 'p1',
        items: [{ ...baseItem, dosage: '20mg/5ml', doseAmountMg: 20, dosesPerDay: 3 }],
      },
      'doc1',
    );
    expect(result.id).toBe('rx1');

    // Push the same weight/dose just over the neonatal ceiling — only rejected
    // if the neonatal row (not the general fallback) was the one selected.
    await expect(
      service.create(
        {
          patientId: 'p1',
          items: [{ ...baseItem, dosage: '25mg/5ml', doseAmountMg: 25, dosesPerDay: 3 }],
        },
        'doc1',
      ),
    ).rejects.toThrow(/outside the recommended/i);
  });

  // ── D3: empty reference table is logged, not silent ─────────────────

  it('checks whether the reference table has any active rows on startup', async () => {
    prisma.medicineDoseReference.count.mockResolvedValue(0);
    await service.onModuleInit();
    expect(prisma.medicineDoseReference.count).toHaveBeenCalledWith({ where: { isActive: true } });
  });

  // ── D6: re-checking on update ────────────────────────────────────────

  describe('updateItems', () => {
    it('re-runs the allergy check against the revised medicines', async () => {
      prisma.prescription.findUnique.mockResolvedValue({
        id: 'rx1', status: 'ACTIVE', patientId: 'p1',
        patient: { allergies: ['Amoxicillin'], dateOfBirth: NON_INFANT_DOB },
      });

      await expect(
        service.updateItems('rx1', { items: [baseItem] }),
      ).rejects.toThrow(/allergic to/i);

      expect(prisma.prescriptionItem.deleteMany).not.toHaveBeenCalled();
    });

    it('re-runs the dose check against the patient\'s current weight', async () => {
      prisma.prescription.findUnique.mockResolvedValue({
        id: 'rx1', status: 'ACTIVE', patientId: 'p1',
        patient: { allergies: [], dateOfBirth: NON_INFANT_DOB },
      });
      prisma.medicineDoseReference.findMany.mockResolvedValue([AMOXICILLIN_REF]);
      prisma.vitalSign.findFirst.mockResolvedValue({ weightKg: 10, recordedAt: daysAgo(1) });

      await expect(
        service.updateItems('rx1', {
          items: [{ ...baseItem, dosage: '500mg/5ml', doseAmountMg: 500, dosesPerDay: 3 }],
        }),
      ).rejects.toThrow(/outside the recommended/i);
    });

    it('replaces the items when the revised medicines pass every check', async () => {
      prisma.prescription.findUnique.mockResolvedValue({
        id: 'rx1', status: 'ACTIVE', patientId: 'p1',
        patient: { allergies: [], dateOfBirth: NON_INFANT_DOB },
      });
      prisma.prescription.update.mockResolvedValue({ id: 'rx1', items: [baseItem] });

      const result = await service.updateItems('rx1', { items: [baseItem] });

      expect(prisma.prescriptionItem.deleteMany).toHaveBeenCalledWith({
        where: { prescriptionId: 'rx1' },
      });
      expect(prisma.prescription.update).toHaveBeenCalled();
      expect(result.id).toBe('rx1');
    });

    it('refuses to edit medicines on a prescription that is no longer active', async () => {
      prisma.prescription.findUnique.mockResolvedValue({
        id: 'rx1', status: 'COMPLETED', patientId: 'p1',
        patient: { allergies: [], dateOfBirth: NON_INFANT_DOB },
      });

      await expect(
        service.updateItems('rx1', { items: [baseItem] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound for an unknown prescription', async () => {
      prisma.prescription.findUnique.mockResolvedValue(null);
      await expect(
        service.updateItems('nope', { items: [baseItem] }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
