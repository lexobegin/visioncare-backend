import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY, Rol } from '../decorators/roles.decorator';
import { UsuarioJwt } from '../decorators/current-user.decorator';

/**
 * ══════════════════════════════════════════════════════
 * Guard global de autorización por roles.
 *
 * Flujo (siempre DESPUÉS de JwtAuthGuard):
 *   1. Ruta con @Public()            → permite el paso.
 *   2. Ruta SIN @Roles(...)          → permite cualquier
 *      usuario autenticado.
 *   3. Ruta con @Roles('ADMIN')      → compara el rol del
 *      JWT (request.user.rol) con la lista permitida.
 *      Si no coincide → 403 Forbidden.
 *
 * Roles disponibles (tabla usuarios):
 *   'USUARIO' | 'ADMIN' | 'INSTITUCION'
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1) Rutas públicas no pasan por autorización
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublica) return true;

    // 2) Sin @Roles() → solo se exige estar autenticado
    const rolesRequeridos = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesRequeridos || rolesRequeridos.length === 0) return true;

    // 3) Comparar rol del token contra los permitidos
    const usuario = context.switchToHttp().getRequest().user as
      | UsuarioJwt
      | undefined;

    // Defensivo: si no hay usuario, JwtAuthGuard no se ejecutó antes
    // (verificar orden de APP_GUARD en AppModule)
    if (!usuario) {
      throw new ForbiddenException(
        'RolesGuard requiere autenticación previa (JwtAuthGuard).',
      );
    }

    const autorizado = rolesRequeridos.includes(usuario.rol);
    if (!autorizado) {
      throw new ForbiddenException(
        `Tu rol '${usuario.rol}' no tiene permiso para esta acción. ` +
          `Roles permitidos: ${rolesRequeridos.join(', ')}.`,
      );
    }

    return true;
  }
}