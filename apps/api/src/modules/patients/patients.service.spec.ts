import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PatientsService } from './patients.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GenderEnum } from './dto/create-patient.dto';

const mockPrisma = () => ({
  patient: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('PatientsService', () => {
  let service: PatientsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PatientsService, { provide: PrismaService, useFactory: mockPrisma }],
    }).compile();

    service = module.get(PatientsService);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    it('generates the first MRN of the year when none exist', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);
      prisma.patient.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: 'c1', guardians: [] }),
      );

      const result = await service.create({
        firstName: 'Liam',
        lastName: 'Dela Cruz',
        dateOfBirth: '2023-04-15',
        gender: GenderEnum.MALE,
      });

      const year = new Date().getFullYear();
      expect(result.mrn).toBe(`PT-${year}-00001`);
    });

    it('increments from the highest existing MRN, not the patient count', async () => {
      const year = new Date().getFullYear();
      prisma.patient.findFirst.mockResolvedValue({ mrn: `PT-${year}-00042` });
      prisma.patient.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: 'c2', guardians: [] }),
      );

      const result = await service.create({
        firstName: 'Sofia',
        lastName: 'Garcia',
        dateOfBirth: '2024-01-10',
        gender: GenderEnum.FEMALE,
      });

      expect(result.mrn).toBe(`PT-${year}-00043`);
    });

    it('marks the first guardian primary when none is flagged', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);
      prisma.patient.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: 'c3', dateOfBirth: new Date(), guardians: [] }),
      );

      await service.create({
        firstName: 'Noah',
        lastName: 'Reyes',
        dateOfBirth: '2025-01-01',
        gender: GenderEnum.MALE,
        guardians: [
          { firstName: 'Carla', lastName: 'Reyes', relationship: 'Mother', phone: '0918' },
          { firstName: 'Ben', lastName: 'Reyes', relationship: 'Father', phone: '0919' },
        ],
      });

      const created = prisma.patient.create.mock.calls[0][0].data.guardians.create;
      expect(created[0].isPrimary).toBe(true);
      expect(created[1].isPrimary).toBe(false);
    });
  });

  describe('findOne', () => {
    it('attaches a computed age to the patient', async () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 3);

      prisma.patient.findFirst.mockResolvedValue({
        id: 'c1', mrn: 'PT-2026-00001', dateOfBirth: dob, guardians: [],
      });

      const result = await service.findOne('c1');
      expect(result.age.years).toBe(3);
    });

    it('throws NotFound for an archived or missing patient', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes rather than destroying the record', async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.patient.update.mockResolvedValue({ id: 'c1' });

      await service.remove('c1');

      const data = prisma.patient.update.mock.calls[0][0].data;
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(data.isActive).toBe(false);
    });
  });
});
