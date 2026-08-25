import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@peditrack/database';

/**
 * SEC-013 fix: cleanDatabase() has been completely removed from this class.
 *
 * The original implementation kept a "delete every row in every table" method
 * inside the production service, guarded only by a NODE_ENV check. A single
 * misconfiguration (missing env var, staging that forgot NODE_ENV) would allow
 * the method to run and wipe the entire database.
 *
 * The method has been moved to test/helpers/database-cleaner.ts (a file that
 * is excluded from the production tsconfig paths and therefore never compiled
 * into the production bundle). Import it from there in spec files only:
 *
 *   import { cleanDatabase } from '../../../test/helpers/database-cleaner';
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        // SEC-014 fix: the 'query' event is removed from the development log.
        // Prisma's query-level logging emits the full SQL statement including all
        // parameter values — patient names, MRNs, allergy lists, prescription contents —
        // which constitutes PHI written to application logs.  In any cloud dev
        // environment with log aggregation (CloudWatch, Datadog, GCP Logging) this
        // routes PHI to a log store with different retention/access controls.
        // 'info', 'warn', and 'error' are retained because they carry operational
        // signals that do not contain patient data.
        process.env.NODE_ENV === 'development'
          ? ['info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }
}
