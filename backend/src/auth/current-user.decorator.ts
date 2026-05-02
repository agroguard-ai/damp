/* eslint-disable @typescript-eslint/no-unsafe-return */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface ClerkTokenPayload {
  sub: string;
  [key: string]: any;
}

export interface AuthenticatedRequest extends Request {
  user: ClerkTokenPayload;
}

export const CurrentUser = createParamDecorator((data: keyof ClerkTokenPayload | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  const user = request.user;

  if (!user) {
    return null;
  }

  return data ? user[data] : user;
});
