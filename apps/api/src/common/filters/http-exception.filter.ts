import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException,
  HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@peditrack/database';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const body = res as Record<string, unknown>;
        message = (body.message as string | string[]) ?? exception.message;
        error = (body.error as string) ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, message, error } = this.mapPrismaError(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      error = 'ValidationError';
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} — ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002': {
        const target = (e.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${target} already exists`,
          error: 'DuplicateRecord',
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'The requested record was not found',
          error: 'NotFound',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Referenced record does not exist',
          error: 'ForeignKeyConstraint',
        };
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'This change would break a required relation',
          error: 'RelationViolation',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred',
          error: 'DatabaseError',
        };
    }
  }
}
