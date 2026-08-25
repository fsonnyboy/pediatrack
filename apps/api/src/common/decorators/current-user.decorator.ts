import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@peditrack/types';

/** Injects the authenticated user (populated by JwtStrategy) into a handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    return data ? user?.[data] : user;
  },
);
