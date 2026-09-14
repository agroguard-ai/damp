/* eslint-disable @typescript-eslint/no-unsafe-return */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  globalRole: string;
  name?: string;
  mustChangePassword?: boolean;
  isEmulated?: boolean;
  realSuperAdminId?: string;
  [key: string]: any;
}

// Alias for backwards-compatibility during transition
export type ClerkTokenPayload = JwtPayload;

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export const CurrentUser = createParamDecorator((data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  const user = request.user;

  if (!user) {
    return null;
  }

  return data ? user[data] : user;
});
