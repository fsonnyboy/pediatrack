import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * SEC-015 fix: replaced req.url (full path + query string) with req.path
 * (path segment only, no query parameters).
 *
 * The original implementation logged the complete URL including query string:
 *   GET /patients?search=JohnDoe&dob=2010-04-15&gender=MALE — 42ms
 *
 * Patient names, MRN prefixes, dates-of-birth, and other PHI routinely appear
 * in search/filter parameters and would have been written to application logs,
 * which may be shipped to third-party aggregators with different retention and
 * access-control policies than the database.
 *
 * The fixed log line contains only:
 *   - HTTP method
 *   - Path (no query string)
 *   - Response status code
 *   - Duration in milliseconds
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    // SEC-015 fix: req.path excludes the query string; req.url includes it.
    const { method, path } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        // Log format: METHOD /path STATUS ms
        this.logger.log(`${method} ${path} ${res.statusCode} — ${ms}ms`);
      }),
    );
  }
}
