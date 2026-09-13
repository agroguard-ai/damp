import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject, Logger } from '@nestjs/common';
import { verifyToken, type ClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthorizedRequest } from '@/auth/guards/global-roles.guard';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject('ClerkClient') private readonly clerkClient: ClerkClient
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();

    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!bearerToken) {
      throw new UnauthorizedException('No authentication token provided');
    }

    let tokenPayload;
    try {
      const secretKey = this.configService.getOrThrow<string>('CLERK_SECRET_KEY');
      tokenPayload = await verifyToken(bearerToken, {
        secretKey,
      });

      if (!tokenPayload) {
        throw new UnauthorizedException('Invalid session token');
      }
    } catch (err) {
      this.logger.error('Token verification error:', err);
      throw new UnauthorizedException('Invalid or expired token');
    }

    // JwtPayload viene de @clerk/shared/types, un subpath que @clerk/backend no re-exporta y
    // pnpm no expone acá — de ahí los disable de abajo, mismo patrón que collars.service.ts.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    request.user = tokenPayload;

    // El webhook de Clerk (user.created/user.updated, ver WebhookService) es la vía normal
    // para sincronizar `users`, pero si el endpoint nunca se configuró en el Dashboard de Clerk
    // (o el signing secret no coincide), el evento nunca llega y no hay ningún otro fallback:
    // GlobalRolesGuard y FarmRoleGuard dependen de encontrar esta fila y devuelven 403 para
    // SIEMPRE, sin importar cuántas veces el usuario inicie sesión correctamente. Este upsert
    // hace que el propio login se autocure sin depender de que ese webhook funcione.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    request.dbUser = await this.ensureDbUser(tokenPayload.sub as string);

    return true;
  }

  private async ensureDbUser(clerkId: string) {
    const existing = await this.prisma.user.findUnique({ where: { clerkId } });
    if (existing) {
      return existing;
    }

    const clerkUser = await this.clerkClient.users.getUser(clerkId);
    const email = clerkUser.primaryEmailAddress?.emailAddress;
    if (!email) {
      throw new UnauthorizedException('Clerk user has no primary email address');
    }

    // upsert (no create): dos requests casi simultáneas del mismo login nuevo (pestañas
    // paralelas) pueden pisarse acá — sin esto, la segunda rompería con el unique de clerkId.
    return this.prisma.user.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId, email },
    });
  }
}
