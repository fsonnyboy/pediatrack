import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Wraps every successful response in a consistent envelope.
 * Paginated payloads (already shaped { data, meta }) are passed through
 * so the meta block is not nested twice.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        const isPaginated =
          payload && typeof payload === 'object' && 'data' in payload && 'meta' in payload;

        return {
          success: true as const,
          ...(isPaginated ? payload : { data: payload }),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
