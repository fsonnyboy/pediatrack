import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SEC-016 fix: centralised PHI access audit logger.
 *
 * HIPAA and equivalent regulations require an audit trail of ALL access to
 * Protected Health Information (PHI), not just mutations. The original codebase
 * only logged LOGIN events; reading a patient record, fetching prescriptions,
 * viewing clinical notes, or accessing the growth chart were unrecorded.
 *
 * This service writes to the existing AuditLog table and is injected into every
 * service that reads PHI (PatientsService, AppointmentsService, etc.).
 *
 * For a production system, consider supplementing with:
 *   - A Prisma middleware that automatically logs all findMany/findUnique on PHI
 *     models (catches accidental omissions from new endpoints).
 *   - Shipping audit logs to an immutable, append-only log store (CloudTrail,
 *     GCP Audit Logs, or a write-once S3 bucket) to satisfy HIPAA's 6-year
 *     retention requirement.
 */
export type AuditAction =
  | 'READ'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE';

export type AuditEntity =
  | 'Patient'
  | 'Appointment'
  | 'Prescription'
  | 'MedicalNote'
  | 'VaccinationRecord'
  | 'VitalSign'
  | 'ScreeningAdministration'
  | 'ScreeningReferral'
  | 'MilestoneObservation'
  | 'DevelopmentalConcern'
  | 'User';

export interface AuditEventDto {
  userId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  /** Optional human-readable detail (sub-resource, filter used, etc.) */
  detail?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit event.  Failures are caught and logged — a broken audit
   * trail must never cause an endpoint to return an error to the user, but the
   * failure is surfaced loudly so ops can investigate.
   */
  async log(event: AuditEventDto): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: event.userId,
          action: event.action,
          entity: event.entity,
          entityId: event.entityId ?? null,
          // The AuditLog model has no `detail` column — free-text context goes
          // into the `metadata` Json field.
          metadata: event.detail ? { detail: event.detail } : undefined,
          createdAt: new Date(),
        },
      });
    } catch (err) {
      // Never propagate audit failures to callers — surface loudly instead.
      this.logger.error(
        `[AUDIT FAILURE] Could not write audit event: ${JSON.stringify(event)}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
