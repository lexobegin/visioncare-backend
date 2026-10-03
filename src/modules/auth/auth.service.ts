import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { JwtConfig } from '../../config/jwt.config';
import { Perfil } from '../usuarios/entities/perfil.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { LoginDto, RegistroDto } from './dto';
import { TokenResponseDto, UsuarioAuthDto } from './dto/token-response.dto';
import { JwtPayload } from './jwt.strategy';

import { HistorialService } from '../historial/historial.service';
import { TIPOS_ACTIVIDAD } from '../historial/entities/historial-actividad.entity';


/** Costo de bcrypt: 12 rondas (buena relación seguridad/rendimiento) */
const BCRYPT_ROUNDS = 12;

/**
 * ══════════════════════════════════════════════════════
 * Servicio de autenticación:
 *   - registrar(): CU01 — crea usuario + perfil (transacción)
 *                  y devuelve token (auto-login)
 *   - login():     CU02 — valida credenciales, verifica estado,
 *                  actualiza ultimo_acceso y emite el token
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(Perfil)
    private readonly perfilesRepo: Repository<Perfil>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly historialService: HistorialService,
  ) {}

  // ═══════════════════════ REGISTRO (CU01) ═══════════════════════

  /**
   * Registra un usuario con su perfil en UNA transacción
   * (si el perfil falla, el usuario no queda creado a medias).
   * Devuelve token → el usuario queda logueado inmediatamente.
   */
  async registrar(dto: RegistroDto): Promise<TokenResponseDto> {
    // Verificación previa para dar un mensaje amigable
    const correoExistente = await this.usuariosRepo.findOne({
      where: { correo: dto.correo },
    });
    if (correoExistente) {
      throw new ConflictException('El correo ya está registrado.');
    }

    let usuario: Usuario;
    let perfil: Perfil;

    try {
      const resultado = await this.dataSourceTransaction(dto);
      usuario = resultado.usuario;
      perfil = resultado.perfil;
    } catch (error) {
      // 23505 = unique_violation de PostgreSQL (condición de carrera)
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('El correo ya está registrado.');
      }
      throw error;
    }

    this.logger.log(
      `Usuario registrado: id=${usuario.id_usuario} correo=${usuario.correo}`,
    );

    // Historial (best-effort, nunca interrumpe el flujo)
    await this.historialService.registrar(
      Number(usuario.id_usuario),
      TIPOS_ACTIVIDAD.USUARIO_REGISTRADO,
      Number(usuario.id_usuario),
      `Nuevo usuario registrado (${usuario.correo}).`,
    );

    return this.emitirToken(usuario, perfil);
  }

  /** Transacción: crea usuario (rol USUARIO fijo) + su perfil */
  private async dataSourceTransaction(
    dto: RegistroDto,
  ): Promise<{ usuario: Usuario; perfil: Perfil }> {
    return this.dataSource.transaction(async (em) => {
      const usuario = await em.save(
        em.create(Usuario, {
          correo: dto.correo,
          contrasena_hash: await bcrypt.hash(dto.contrasena, BCRYPT_ROUNDS),
          rol: 'USUARIO', // seguridad: el registro público siempre crea USUARIO
          estado: 'ACTIVO',
          ultimo_acceso: new Date(),
        }),
      );

      const perfil = await em.save(
        em.create(Perfil, {
          id_usuario: usuario.id_usuario,
          nombres: dto.perfil.nombres,
          apellidos: dto.perfil.apellidos,
          telefono: dto.perfil.telefono,
          fecha_nacimiento: dto.perfil.fecha_nacimiento,
          idioma: dto.perfil.idioma ?? 'es',
        }),
      );

      return { usuario, perfil };
    });
  }

  // ═══════════════════════ LOGIN (CU02) ═══════════════════════

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const usuario = await this.buscarUsuarioConHash(dto.correo);

    // Mensaje genérico: no revela si falló el correo o la contraseña
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const contrasenaValida = await bcrypt.compare(
      dto.contrasena,
      usuario.contrasena_hash,
    );
    if (!contrasenaValida) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    // Estado de la cuenta (solo se informa si la contraseña era correcta)
    if (usuario.estado === 'BLOQUEADO') {
      throw new ForbiddenException(
        'Tu cuenta está bloqueada. Contacta al administrador.',
      );
    }
    if (usuario.estado === 'INACTIVO') {
      throw new ForbiddenException('Tu cuenta está inactiva.');
    }

    // Actualizar ultimo_acceso (no bloquea el login si falla)
    await this.usuariosRepo
      .update(
        { id_usuario: Number(usuario.id_usuario) },
        { ultimo_acceso: new Date() },
      )
      .catch((e) => this.logger.warn(`No se pudo actualizar ultimo_acceso: ${e}`));
    
    await this.historialService.registrar(
      Number(usuario.id_usuario),
      TIPOS_ACTIVIDAD.SESION_INICIADA,
      Number(usuario.id_usuario),
      'Inicio de sesión exitoso.',
    );

    const perfil = await this.perfilesRepo.findOne({
      where: { id_usuario: Number(usuario.id_usuario) },
    });

    return this.emitirToken(usuario, perfil);
  }

  /** Busca por correo INCLUYENDO el hash (por select:false se usa query builder) */
  private async buscarUsuarioConHash(correo: string): Promise<Usuario | null> {
    return this.usuariosRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.contrasena_hash') // reintegra el campo oculto
      .where('usuario.correo = :correo', { correo })
      .getOne();
  }

  // ═══════════════════════ TOKEN ═══════════════════════

  /** Firma el JWT con el payload mínimo y arma la respuesta estándar */
  private async emitirToken(
    usuario: Usuario,
    perfil?: Perfil | null,
  ): Promise<TokenResponseDto> {
    const jwt = this.config.get<JwtConfig>('jwt')!;

    const payload: JwtPayload = {
      sub: Number(usuario.id_usuario),
      correo: usuario.correo,
      rol: usuario.rol,
    };

    const access_token = await this.jwtService.signAsync(payload, {
      secret: jwt.secret,
      expiresIn: jwt.segundosValidez,
      issuer: jwt.issuer,
    });

    return {
      ok: true,
      access_token,
      token_type: 'Bearer',
      expires_in: jwt.segundosValidez,
      usuario: this.mapearUsuarioAuth(usuario, perfil),
    };
  }

  /** Nunca exponemos el hash ni campos técnicos */
  private mapearUsuarioAuth(
    usuario: Usuario,
    perfil?: Perfil | null,
  ): UsuarioAuthDto {
    return {
      id_usuario: Number(usuario.id_usuario),
      correo: usuario.correo,
      rol: usuario.rol,
      nombres: perfil?.nombres ?? '',
      apellidos: perfil?.apellidos ?? undefined,
    };
  }
}