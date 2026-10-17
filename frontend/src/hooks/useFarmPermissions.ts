'use client';

import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';

export type FarmRoleName = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export const FARM_ROLE_LABELS: Record<FarmRoleName, string> = {
  ADMIN: 'Administrador de granja',
  OPERATOR: 'Operador',
  VIEWER: 'Solo lectura',
};

const ROLE_RANK: Record<FarmRoleName, number> = { VIEWER: 0, OPERATOR: 1, ADMIN: 2 };

export interface FarmPermissions {
  /** Rol efectivo en la granja (null si no es miembro). */
  role: FarmRoleName | null;
  /** SUPER_ADMIN sin emular: acceso total de plataforma. */
  isPlatformAdmin: boolean;
  /** Crear/editar/eliminar datos operativos (ADMIN u OPERATOR). */
  canEdit: boolean;
  /** Gestionar el personal de la granja, la configuración de alertas y la granja en sí (ADMIN). */
  canManageUsers: boolean;
  /** Granja donde el usuario es ADMIN (para el acceso a "Personal" desde el menú). */
  adminFarmId: string | null;
  /** La sesión todavía se está cargando: no decidir accesos hasta que sea false. */
  loading: boolean;
  /** Para listados con recursos de varias granjas (ej. gateways): ¿puede escribir en esa granja? */
  canEditIn: (farmId: string | null | undefined) => boolean;
}

/**
 * Permisos del usuario actual (o del emulado, si un SUPER_ADMIN está emulando) dentro de una granja.
 * Es solo para la UI: el backend vuelve a validar todo con FarmRoleGuard.
 *
 * Sin `farmId` se toma el rol MÁS BAJO entre sus membresías activas (criterio conservador: no mostrar
 * un botón que el backend después va a rechazar).
 */
export function useFarmPermissions(farmId?: string | null): FarmPermissions {
  const { user, emulatedUser, loading } = useAuth();

  return useMemo(() => {
    const isPlatformAdmin = user?.globalRole === 'SUPER_ADMIN' && !emulatedUser;
    if (isPlatformAdmin) {
      return {
        role: 'ADMIN',
        isPlatformAdmin,
        canEdit: true,
        canManageUsers: true,
        adminFarmId: null,
        loading,
        canEditIn: () => true,
      };
    }

    const memberships = (emulatedUser ?? user)?.farmUsers ?? [];
    const adminFarmId = memberships.find((m) => m.role?.name === 'ADMIN')?.farmId ?? null;
    const canEditIn = (id: string | null | undefined) => {
      const name = id ? memberships.find((m) => m.farmId === id)?.role?.name : undefined;
      return name === 'ADMIN' || name === 'OPERATOR';
    };

    let role: FarmRoleName | null = null;
    if (farmId) {
      role = (memberships.find((m) => m.farmId === farmId)?.role?.name as FarmRoleName | undefined) ?? null;
    } else {
      for (const m of memberships) {
        const name = m.role?.name as FarmRoleName | undefined;
        if (name && name in ROLE_RANK && (role === null || ROLE_RANK[name] < ROLE_RANK[role])) {
          role = name;
        }
      }
    }

    return {
      role,
      isPlatformAdmin,
      canEdit: role === 'ADMIN' || role === 'OPERATOR',
      canManageUsers: role === 'ADMIN',
      adminFarmId,
      loading,
      canEditIn,
    };
  }, [user, emulatedUser, loading, farmId]);
}
