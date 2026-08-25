/**
 * SEC-013 fix: test-only database reset helper.
 *
 * This file is intentionally excluded from the production tsconfig paths.
 * It must ONLY be imported from spec / test files, never from application code.
 *
 * Usage in a Jest beforeEach:
 *
 *   import { cleanDatabase } from '../../test/helpers/database-cleaner';
 *   import { PrismaService } from '../../src/prisma/prisma.service';
 *   // ...
 *   beforeEach(async () => { await cleanDatabase(prismaService); });
 *
 * The function is async and awaitable so teardown errors surface in the test
 * output rather than being swallowed.
 */

import { PrismaClient } from '@peditrack/database';

/**
 * Deletes every row in every model, in an order that respects FK constraints.
 * Safe to run only in test environments — throws if NODE_ENV is 'production'.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[database-cleaner] cleanDatabase() must never be called in production. ' +
      'This file should not be reachable from the production bundle.',
    );
  }

  // Delete in reverse dependency order so FK constraints are satisfied.
  // Adjust the list if you add new models to the schema.
  const deletions: Array<() => Promise<unknown>> = [
    () => prisma.auditLog.deleteMany(),
    () => prisma.medicalNote.deleteMany(),
    () => prisma.prescriptionItem.deleteMany(),
    () => prisma.prescription.deleteMany(),
    () => prisma.vaccinationRecord.deleteMany(),
    () => prisma.vitalSign.deleteMany(),
    () => prisma.appointment.deleteMany(),
    () => prisma.guardian.deleteMany(),
    () => prisma.patient.deleteMany(),
    () => prisma.vaccine.deleteMany(),
    () => prisma.user.deleteMany(),
  ];

  for (const del of deletions) {
    await del();
  }
}
