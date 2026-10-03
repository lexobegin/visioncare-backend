import { SetMetadata } from '@nestjs/common';

/**
 * Roles válidos según la tabla usuarios de la BD:
 * CHECK (rol IN ('USUARIO', 'ADMIN', 'INSTITUCION'))
 */
export type Rol = 'USUARIO' | 'ADMIN' | 'INSTITUCION';

export const ROLES_KEY = 'roles';

/**
 * ══════════════════════════════════════════════════════
 * Declara los roles permitidos en una ruta.
 * La verifica el RolesGuard (Tanda 6) contra el rol del JWT.
 *
 * Uso:
 *   @Roles('ADMIN', 'INSTITUCION')
 *   @Get('usuarios')
 * ══════════════════════════════════════════════════════
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);