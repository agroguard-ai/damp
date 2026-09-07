import { SetMetadata } from '@nestjs/common';

export const RESOLVE_FARM_ID_FROM_KEY = 'resolve_farm_id_from';

/** Recursos desde los que FarmRoleGuard sabe resolver el farmId cuando no viaja directo en la request. */
export type FarmIdResource = 'animal' | 'zone' | 'geofence' | 'gateway' | 'alert';

export interface ResolveFarmIdFromOptions {
  resource: FarmIdResource;
  /** Nombre del campo que trae el id del recurso — se busca en params, después body, después query (mismo orden que el farmId directo). */
  idKey?: string;
}

/**
 * Le dice a FarmRoleGuard cómo encontrar el farmId cuando la ruta no lo trae directo
 * (p. ej. PATCH /animals/:id — :id es del animal, no de la granja). El guard busca
 * `idKey` en params/body/query, resuelve el recurso correspondiente por Prisma y saca
 * su farmId de ahí antes de chequear el rol.
 */
export const ResolveFarmIdFrom = (resource: FarmIdResource, idKey = 'id') =>
  SetMetadata(RESOLVE_FARM_ID_FROM_KEY, { resource, idKey } satisfies ResolveFarmIdFromOptions);
