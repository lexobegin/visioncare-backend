import { SetMetadata } from '@nestjs/common';

/**
 * ══════════════════════════════════════════════════════
 * Marca una ruta como PÚBLICA (no requiere token JWT).
 *
 * La lee el JwtAuthGuard (Tanda 6) para omitir la verificación.
 * Indispensable para: login, registro y health-check.
 *
 * Uso:
 *   @Public()
 *   @Post('login')
 * ══════════════════════════════════════════════════════
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);