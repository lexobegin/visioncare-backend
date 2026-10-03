import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * ══════════════════════════════════════════════════════
 * Guard global de autenticación JWT.
 *
 * Flujo:
 *   1. Si la ruta tiene @Public()  → permite el paso sin token.
 *   2. Si no                       → delega a la estrategia
 *      'jwt' (passport-jwt, Tanda 8), que valida el token del
 *      header Authorization: Bearer <token> y coloca el payload
 *      en request.user.
 *
 * Registro (Tanda 9, en AppModule):
 *   { provide: APP_GUARD, useClass: JwtAuthGuard }   ← PRIMERO
 *   { provide: APP_GUARD, useClass: RolesGuard }     ← DESPUÉS
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // ¿La ruta está marcada como pública? (revisa método y controlador)
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (esPublica) return true;

    // Validación estándar de passport (401 si falta/falla el token)
    return super.canActivate(context);
  }
}