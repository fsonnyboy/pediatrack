import { Injectable, NotFoundException } from '@nestjs/common';
import { calculateCorrectedAge } from '@peditrack/utils';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateMilestoneObservationsDto } from './dto/create-observations.dto';
import { QueryMilestoneDefinitionsDto } from './dto/query-milestones.dto';
import { CreateConcernDto } from './dto/create-concern.dto';
import { UpdateConcernDto } from './dto/update-concern.dto';

const PATIENT_SUMMARY = {
  select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true },
} as const;

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Catalogue ────────────────────────────────────────────

  listDefinitions(query: QueryMilestoneDefinitionsDto) {
    return this.prisma.milestoneDefinition.findMany({
      where: {
        isActive: true,
        ...(query.ageMonths ? { checklistAgeMonths: query.ageMonths } : {}),
      },
      orderBy: [{ checklistAgeMonths: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  // ── Observations ─────────────────────────────────────────

  async createObservations(dto: CreateMilestoneObservationsDto, observedById: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, deletedAt: null } });
    if (!patient) throw new NotFoundException('Patient not found');

    const definitionIds = dto.items.map((item) => item.definitionId);
    const definitions = await this.prisma.milestoneDefinition.findMany({
      where: { id: { in: definitionIds } },
    });
    if (definitions.length !== new Set(definitionIds).size) {
      throw new NotFoundException('One or more milestone definitions were not found');
    }

    const observedAt = new Date(dto.observedAt);
    // Never trust a client-supplied age — derive both bases server-side, same
    // as the corrected-age fix applied to the growth chart.
    const age = calculateCorrectedAge(patient.dateOfBirth, patient.gestationalAge, observedAt);

    const created = await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.milestoneObservation.create({
          data: {
            patientId: dto.patientId,
            definitionId: item.definitionId,
            appointmentId: dto.appointmentId,
            observedById,
            status: item.status,
            source: item.source ?? 'CLINICIAN_OBSERVED',
            note: item.note,
            observedAt,
            chronologicalAgeMonths: age.chronologicalMonths,
            correctedAgeMonths: age.ageBasisUsed === 'CORRECTED' ? age.correctedMonths : null,
            ageBasisUsed: age.ageBasisUsed,
          },
          include: { definition: true },
        }),
      ),
    );

    await this.audit.log({
      userId: observedById,
      action: 'CREATE',
      entity: 'MilestoneObservation',
      entityId: created[0]?.id,
      detail: `${created.length} milestone(s) recorded for patient ${patient.mrn}`,
    });

    return created;
  }

  // ── Concerns ─────────────────────────────────────────────
  //
  // Eliciting and documenting caregiver concern is a named component of
  // surveillance in its own right, distinct from the milestone checklist.

  async createConcern(dto: CreateConcernDto, recordedById: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, deletedAt: null } });
    if (!patient) throw new NotFoundException('Patient not found');

    const concern = await this.prisma.developmentalConcern.create({
      data: {
        patientId: dto.patientId,
        appointmentId: dto.appointmentId,
        recordedById,
        source: dto.source,
        domain: dto.domain,
        description: dto.description,
        actionTaken: dto.actionTaken,
        raisedAt: dto.raisedAt ? new Date(dto.raisedAt) : new Date(),
      },
    });

    await this.audit.log({
      userId: recordedById,
      action: 'CREATE',
      entity: 'DevelopmentalConcern',
      entityId: concern.id,
      detail: `${dto.source} concern recorded for patient ${patient.mrn}`,
    });

    return concern;
  }

  async updateConcern(id: string, dto: UpdateConcernDto, userId: string) {
    const concern = await this.prisma.developmentalConcern.findUnique({ where: { id } });
    if (!concern) throw new NotFoundException('Concern not found');

    const resolvedAt =
      dto.resolved === true ? (concern.resolvedAt ?? new Date())
      : dto.resolved === false ? null
      : concern.resolvedAt;

    const updated = await this.prisma.developmentalConcern.update({
      where: { id },
      data: {
        actionTaken: dto.actionTaken ?? concern.actionTaken,
        resolvedAt,
      },
    });

    await this.audit.log({
      userId,
      action: 'UPDATE',
      entity: 'DevelopmentalConcern',
      entityId: id,
      detail: dto.resolved === true ? 'resolved' : dto.resolved === false ? 'reopened' : 'action updated',
    });

    return updated;
  }

  /** Concerns raised but not yet resolved — the loop is still open. */
  openConcerns() {
    return this.prisma.developmentalConcern.findMany({
      where: { resolvedAt: null },
      orderBy: { raisedAt: 'asc' },
      include: { patient: PATIENT_SUMMARY },
    });
  }
}
