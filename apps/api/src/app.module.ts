import { ExecutionContext, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { GuardiansModule } from './modules/guardians/guardians.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { VaccinationsModule } from './modules/vaccinations/vaccinations.module';
import { ScreeningsModule } from './modules/screenings/screenings.module';
import { MilestonesModule } from './modules/milestones/milestones.module';
import { DiagnosesModule } from './modules/diagnoses/diagnoses.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            // SEC-025: named so @Throttle({ default: {...} }) can override per-route.
            name: 'default',
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
          {
            // SEC-004: separate budget for authentication endpoints.
            // 5 attempts per 15 minutes — applied on the /auth/login route
            // via @Throttle({ auth: { limit: 5, ttl: 900_000 } }).
            name: 'auth',
            ttl: config.get<number>('AUTH_THROTTLE_TTL', 900) * 1000,
            limit: config.get<number>('AUTH_THROTTLE_LIMIT', 5),
          },
        ],
        // SEC-025 fix: key the rate-limit budget by authenticated user ID
        // (injected by Passport onto req.user) rather than by IP address alone.
        // This ensures that multiple staff members sharing a single clinic NAT
        // IP each get their own independent budget instead of collapsing into
        // one shared allowance that any one user can exhaust.
        //
        // Unauthenticated routes (login, public) still fall back to IP-based
        // tracking, which is the conservative default.
        //
        // TODO: replace the in-memory store with Redis (ioredis + ThrottlerStorageRedis)
        // before deploying multiple API instances — the current in-process Map
        // is not shared across pods and resets on restart.
        generateKey: (ctx: ExecutionContext, _suffix: string, _throttlerName: string): string => {
          const req = ctx.switchToHttp().getRequest<{ user?: { id?: string }; ip?: string }>();
          const userId = req?.user?.id;
          return userId ?? req?.ip ?? 'anon';
        },
      }),
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    GuardiansModule,
    AppointmentsModule,
    VaccinationsModule,
    ScreeningsModule,
    MilestonesModule,
    DiagnosesModule,
    PrescriptionsModule,
    DashboardModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
