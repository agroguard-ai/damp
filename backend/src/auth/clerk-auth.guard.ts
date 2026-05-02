import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';

import { AuthenticatedRequest } from './current-user.decorator';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!bearerToken) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
      const tokenPayload = await verifyToken(bearerToken, {
        secretKey,
      });

      if (!tokenPayload) {
        throw new UnauthorizedException('Invalid session token');
      }

      request.user = tokenPayload;

      return true;
    } catch (err) {
      this.logger.error('Token verification error:', err);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
