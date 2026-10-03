import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UsuarioJwt } from '../../common/decorators/current-user.decorator';
import { JwtConfig } from '../../config/jwt.config';
import { RolUsuario, Usuario } from '../usuarios/entities/usuario.entity';

/**
 * ══════════════════════════════════════════════════════
 * Estrategia JWT (passport-jwt) — valida el Bearer token.
 *
 * Flujo en cada petición protegida:
 *   1. JwtAuthGuard extrae el header Authorization: Bearer <token>
 *   2. passport verifica firma, expiración y emisor (issuer)
 *   3. validate() confirma en BD que el usuario exista y esté ACTIVO
 *   4. El retorno pasa a request.user (lo usa @CurrentUser y RolesGuard)
 * ══════════════════════════════════════════════════════
 */
export interface JwtPayload {
  /** Estándar JWT: subject = id del usuario */
  sub: number;
  correo: string;
  rol: RolUsuario;
  iss?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
  ) {
    const jwt = configService.get<JwtConfig>('jwt')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.secret,
      issuer: jwt.issuer,
    });
  }

  async validate(payload: JwtPayload): Promise<UsuarioJwt> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token inválido.');
    }

    // Verificación en BD: permite bloquear/desactivar una cuenta
    // y que surta efecto de inmediato (sin esperar a que expire el token)
    const usuario = await this.usuariosRepo.findOne({
      where: { id_usuario: Number(payload.sub) },
    });

    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException(
        'La cuenta no existe, está inactiva o bloqueada.',
      );
    }

    return {
      id_usuario: Number(payload.sub),
      correo: usuario.correo,
      rol: usuario.rol,
    };
  }
}