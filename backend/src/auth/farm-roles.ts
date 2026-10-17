/**
 * Roles a nivel de granja (CU018). Los nombres coinciden con las filas de la tabla `roles`
 * que crea el seed.
 * - ADMIN: todo dentro de su granja, incluida la gestión de usuarios y la configuración de alertas.
 * - OPERATOR: todo menos administrar usuarios, configurar alertas y editar/dar de baja la granja.
 * - VIEWER: solo lectura.
 */
export const FARM_ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'] as const;
export type FarmRoleName = (typeof FARM_ROLES)[number];

/** Roles que pueden crear/modificar/eliminar datos operativos de la granja. */
export const FARM_WRITE_ROLES: readonly FarmRoleName[] = ['ADMIN', 'OPERATOR'];
