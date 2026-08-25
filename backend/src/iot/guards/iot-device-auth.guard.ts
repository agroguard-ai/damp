import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GatewaysService } from '@/gateways/gateways.service';

/**
 * Autentica al GATEWAY físico (no al usuario) que llama a POST /api/iot/telemetry — sin esto,
 * cualquiera que supiera un collar_id válido podía inyectar telemetría falsa (deuda documentada
 * en CLAUDE.md). El gateway manda su propio gateway_id (UUID de la tabla `gateways`, el mismo
 * que ya se usa para el heartbeat) más un header X-API-Key con la clave que recibió al
 * registrarse (ver GatewaysService.create). No es autenticación de usuario: no hay token Clerk
 * acá, el dispositivo no tiene sesión de usuario.
 */
@Injectable()
export class IotDeviceAuthGuard implements CanActivate {
  constructor(private readonly gatewaysService: GatewaysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const gatewayId = request.body?.gateway_id;

    if (!gatewayId || typeof gatewayId !== 'string') {
      throw new UnauthorizedException('Missing gateway_id — el gateway debe identificarse para mandar telemetría');
    }
    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const valid = await this.gatewaysService.validateApiKey(gatewayId, apiKey);
    if (!valid) {
      throw new UnauthorizedException('Invalid gateway_id/X-API-Key combination');
    }

    return true;
  }
}
