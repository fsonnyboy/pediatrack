import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { QueryDiagnosisCodesDto } from './dto/query-diagnosis-codes.dto';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';

@Injectable()
export class DiagnosesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Catalogue ────────────────────────────────────────────

  /**
   * Search the diagnosis code catalogue, ranked by how often this clinic has
   * actually used each code — not alphabetically. Coded diagnosis only gets
   * adopted if finding the code is faster than typing free text, and
   * frequency ranking plus matching on clinician vocabulary (`searchTerms`)
   * is what makes that true.
   *
   * Filtering happens in application code rather than SQL: the catalogue is
   * a curated pediatric short-list (at most a few hundred rows), so loading
   * it and filtering in memory is simpler than hand-written ILIKE-over-array
   * SQL and cheap at this scale. Revisit before this grows to the full
   * ICD-10-CM set of tens of thousands of codes.
   */
  async searchCodes(query: QueryDiagnosisCodesDto) {
    const { q, pediatricOnly, limit = 20 } = query;
    const needle = q?.trim().toLowerCase();

    const codes = await this.prisma.diagnosisCode.findMany({
      where: pediatricOnly ? { isPediatric: true } : undefined,
    });

    const matches = needle
      ? codes.filter(
          (c) =>
            c.code.toLowerCase().includes(needle) ||
            c.display.toLowerCase().includes(needle) ||
            c.searchTerms.some((t) => t.toLowerCase().includes(needle)),
        )
      : codes;

    if (!matches.length) return [];

    const usage = await this.prisma.patientDiagnosis.groupBy({
      by: ['codeId'],
      where: { codeId: { in: matches.map((c) => c.id) } },
      _count: { codeId: true },
    });
    const usageByCode = new Map(usage.map((u) => [u.codeId, u._count.codeId]));

    return matches
      .map((c) => ({ ...c, usageCount: usageByCode.get(c.id) ?? 0 }))
      .sort(
        (a, b) =>
          b.usageCount - a.usageCount ||
          Number(b.isPediatric) - Number(a.isPediatric) ||
          a.display.localeCompare(b.display),
      )
      .slice(0, limit);
  }

  // ── Patient problem list ─────────────────────────────────

  async createDiagnosis(dto: CreateDiagnosisDto, diagnosedById: string) {
    const [patient, code] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: dto.patientId, deletedAt: null } }),
      this.prisma.diagnosisCode.findUnique({ where: { id: dto.codeId } }),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (!code) throw new NotFoundException('Diagnosis code not found');

    const diagnosis = await this.prisma.patientDiagnosis.create({
      data: {
        patientId: dto.patientId,
        codeId: dto.codeId,
        appointmentId: dto.appointmentId,
        diagnosedById,
        status: dto.status ?? 'ACTIVE',
        certainty: dto.certainty ?? 'CONFIRMED',
        isPrimary: dto.isPrimary ?? false,
        onsetDate: dto.onsetDate ? new Date(dto.onsetDate) : undefined,
        clinicalNote: dto.clinicalNote,
      },
      include: { code: true },
    });

    await this.audit.log({
      userId: diagnosedById,
      action: 'CREATE',
      entity: 'PatientDiagnosis',
      entityId: diagnosis.id,
      detail: `${code.system} ${code.code} for patient ${patient.mrn}`,
    });

    return diagnosis;
  }

  async updateDiagnosis(id: string, dto: UpdateDiagnosisDto, userId: string) {
    const existing = await this.prisma.patientDiagnosis.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Diagnosis not found');

    // An explicit resolvedDate always wins. Otherwise: newly RESOLVED stamps
    // now; moving off RESOLVED clears it — a reopened problem has no
    // resolution date until it resolves again.
    const resolvedDate =
      dto.resolvedDate !== undefined ? new Date(dto.resolvedDate)
      : dto.status === 'RESOLVED' && existing.status !== 'RESOLVED' ? new Date()
      : dto.status && dto.status !== 'RESOLVED' && existing.status === 'RESOLVED' ? null
      : existing.resolvedDate;

    const updated = await this.prisma.patientDiagnosis.update({
      where: { id },
      data: {
        status: dto.status ?? existing.status,
        certainty: dto.certainty ?? existing.certainty,
        isPrimary: dto.isPrimary ?? existing.isPrimary,
        clinicalNote: dto.clinicalNote ?? existing.clinicalNote,
        resolvedDate,
      },
      include: { code: true },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'PatientDiagnosis',
      entityId: id,
    });

    return updated;
  }
}
