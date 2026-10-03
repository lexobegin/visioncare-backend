import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * ══════════════════════════════════════════════════════
 * Inyecta el usuario autenticado (payload del JWT) como
 * parámetro del método del controlador.
 *
 * Uso:
 *   @Get('mi-perfil')
 *   miPerfil(@CurrentUser() usuario: UsuarioJwt) { ... }
 *
 *   @Get('mis-capturas')
 *   misCapturas(@CurrentUser('id_usuario') id: number) { ... }
 * ══════════════════════════════════════════════════════
 */
export interface UsuarioJwt {
  id_usuario: number;
  correo: string;
  rol: 'USUARIO' | 'ADMIN' | 'INSTITUCION';
}

export const CurrentUser = createParamDecorator(
  (campo: keyof UsuarioJwt | undefined, ctx: ExecutionContext): UsuarioJwt | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const usuario = request.user as UsuarioJwt | undefined;
    return campo ? usuario?.[campo] : usuario;
  },
);