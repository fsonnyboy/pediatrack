import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// ─── Weak / placeholder secrets that must never reach production ───────────
const INSECURE_JWT_SECRETS = new Set([
  'CHANGE_ME_TO_A_LONG_RANDOM_SECRET',
  'changeme',
  'secret',
  'jwt_secret',
  'your_jwt_secret',
  '',
]);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 3001);
  const prefix = config.get<string>('API_PREFIX', 'api/v1');
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const logger = new Logger('Bootstrap');

  // ── SEC-003 fix: fail fast when JWT_SECRET is absent or still at its ────
  // placeholder value.  An attacker who knows the secret can forge any token.
  const jwtSecret = config.get<string>('JWT_SECRET', '');
  if (INSECURE_JWT_SECRETS.has(jwtSecret) || jwtSecret.length < 32) {
    logger.error(
      'FATAL: JWT_SECRET is missing or insecure.\n' +
      'Generate a strong secret with:\n' +
      "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
      'then set it in your .env file.',
    );
    process.exit(1);
  }

  app.setGlobalPrefix(prefix);

  // SEC-001 fix: parse cookies so passport-jwt can extract the HttpOnly token.
  app.use(cookieParser());

  app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));

  /**
   * SEC-019 fix: PHI-safe HTTP response headers.
   *
   * Cache-Control: no-store — prevents browsers, CDNs, and reverse proxies from
   *   caching API responses that contain patient data. Without this, a cached
   *   prescription or patient record could be retrieved from the browser cache
   *   by a subsequent user on a shared device.
   *
   * Pragma: no-cache — HTTP/1.0 compatibility for the same purpose.
   *
   * Referrer-Policy: no-referrer — prevents patient-related URL paths or search
   *   terms from appearing in the Referer header sent to third-party services.
   *
   * Strict-Transport-Security — in production, force HTTPS for 1 year.
   *   includeSubDomains extends the policy to any sub-domain.
   *
   * These headers are applied globally to every API response after helmet so
   * they cannot be overridden by helmet's defaults.
   */
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (isProd) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

    next();
  });

  app.enableCors({
    origin: config.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(','),
    credentials: true,  // required so the browser sends the auth cookie cross-origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // SEC-026 fix: disable implicit type coercion in the ValidationPipe.
  // With enableImplicitConversion:true, a query param like ?page=abc is
  // silently coerced to NaN and passed to Prisma.  All DTOs already use
  // explicit @Type() decorators where numeric conversion is needed.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger — development only
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PediTrack API')
      .setDescription('Pediatric clinic management platform — REST API')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'JWT',
      )
      .addCookieAuth('peditrack_token')
      .addTag('Auth', 'Authentication and session management')
      .addTag('Patients', 'Patient records and profiles')
      .addTag('Guardians', 'Parent and caregiver records')
      .addTag('Appointments', 'Booking, check-ups and visits')
      .addTag('Vaccinations', 'Immunization tracking')
      .addTag('Prescriptions', 'Medicines and prescriptions')
      .addTag('Dashboard', 'Aggregated clinic statistics')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);

  logger.log(`PediTrack API running on http://localhost:${port}/${prefix}`);
  if (!isProd) logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
