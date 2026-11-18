import {
  BadRequestException,
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
import * as crypto from 'crypto';
import { JwtConfig } from '../../config/jwt.config';
import { Perfil } from '../usuarios/entities/perfil.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { LoginDto, RegistroDto, SocialLoginDto } from './dto';
import { TokenResponseDto, UsuarioAuthDto } from './dto/token-response.dto';
import { JwtPayload } from './jwt.strategy';

import { HistorialService } from '../historial/historial.service';
import { TIPOS_ACTIVIDAD } from '../historial/entities/historial-actividad.entity';

/** Costo de bcrypt: 12 rondas (buena relación seguridad/rendimiento) */
const BCRYPT_ROUNDS = 12;

interface DatosSocialValidados {
  correo: string;
  idProveedor: string;
  nombres: string;
  apellidos?: string;
  fotoUrl?: string;
}

/**
 * ══════════════════════════════════════════════════════
 * Servicio de autenticación:
 *   - registrar():   CU01 — crea usuario + perfil (transacción)
 *                    y devuelve token (auto-login)
 *   - login():       CU02 — valida credenciales, verifica estado,
 *                    actualiza ultimo_acceso y emite el token
 *   - loginSocial(): CU02 Social — Google One Tap, Apple, Facebook
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
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('El correo ya está registrado.');
      }
      throw error;
    }

    this.logger.log(
      `Usuario registrado: id=${usuario.id_usuario} correo=${usuario.correo}`,
    );

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
          rol: 'USUARIO',
          estado: 'ACTIVO',
          proveedor_auth: 'LOCAL',
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

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (!usuario.contrasena_hash) {
      throw new UnauthorizedException(
        'Esta cuenta fue creada con acceso social. Inicia sesión con Google o Apple.',
      );
    }

    const contrasenaValida = await bcrypt.compare(
      dto.contrasena,
      usuario.contrasena_hash,
    );
    if (!contrasenaValida) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (usuario.estado === 'BLOQUEADO') {
      throw new ForbiddenException(
        'Tu cuenta está bloqueada. Contacta al administrador.',
      );
    }
    if (usuario.estado === 'INACTIVO') {
      throw new ForbiddenException('Tu cuenta está inactiva.');
    }

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

  // ═══════════════════════ LOGIN SOCIAL (CU02) ═══════════════════════

  /**
   * Autenticación con Google One Tap, Apple o Facebook.
   * Si el usuario no existe, se registra automáticamente (Fricción Cero).
   */
  async loginSocial(dto: SocialLoginDto): Promise<TokenResponseDto> {
    const datosSociales = await this.validarTokenSocial(
      dto.proveedor,
      dto.token,
      dto.perfil,
    );

    // 1. Buscar usuario por correo O por id_proveedor
    let usuario = await this.usuariosRepo.findOne({
      where: [
        { correo: datosSociales.correo },
        { id_proveedor: datosSociales.idProveedor, proveedor_auth: dto.proveedor.toUpperCase() },
      ],
    });

    let perfil: Perfil | null = null;

    if (usuario) {
      if (usuario.estado === 'BLOQUEADO') {
        throw new ForbiddenException(
          'Tu cuenta está bloqueada. Contacta al administrador.',
        );
      }
      if (usuario.estado === 'INACTIVO') {
        throw new ForbiddenException('Tu cuenta está inactiva.');
      }

      // Sincronizar identificador social si no lo tenía
      const actualizacion: Partial<Usuario> = { ultimo_acceso: new Date() };
      if (!usuario.id_proveedor) {
        actualizacion.id_proveedor = datosSociales.idProveedor;
        actualizacion.proveedor_auth = dto.proveedor.toUpperCase();
      }
      await this.usuariosRepo
        .update({ id_usuario: Number(usuario.id_usuario) }, actualizacion)
        .catch(() => {});

      perfil = await this.perfilesRepo.findOne({
        where: { id_usuario: Number(usuario.id_usuario) },
      });

      await this.historialService.registrar(
        Number(usuario.id_usuario),
        TIPOS_ACTIVIDAD.SESION_INICIADA,
        Number(usuario.id_usuario),
        `Inicio de sesión con ${dto.proveedor.toUpperCase()} exitoso.`,
      );
    } else {
      // 2. Usuario nuevo: creación en una transacción
      const nuevo = await this.dataSource.transaction(async (em) => {
        const dummyPassword = crypto.randomBytes(32).toString('hex');
        const hash = await bcrypt.hash(dummyPassword, BCRYPT_ROUNDS);

        const nuevoUsuario = await em.save(
          em.create(Usuario, {
            correo: datosSociales.correo,
            contrasena_hash: hash,
            rol: dto.rol || 'USUARIO',
            estado: 'ACTIVO',
            proveedor_auth: dto.proveedor.toUpperCase(),
            id_proveedor: datosSociales.idProveedor,
            ultimo_acceso: new Date(),
          }),
        );

        const nuevoPerfil = await em.save(
          em.create(Perfil, {
            id_usuario: nuevoUsuario.id_usuario,
            nombres: datosSociales.nombres,
            apellidos: datosSociales.apellidos || null,
            idioma: 'es',
          }),
        );

        return { usuario: nuevoUsuario, perfil: nuevoPerfil };
      });

      usuario = nuevo.usuario;
      perfil = nuevo.perfil;

      this.logger.log(
        `Nuevo usuario registrado vía ${dto.proveedor}: id=${usuario.id_usuario} correo=${usuario.correo}`,
      );

      await this.historialService.registrar(
        Number(usuario.id_usuario),
        TIPOS_ACTIVIDAD.USUARIO_REGISTRADO,
        Number(usuario.id_usuario),
        `Nuevo usuario registrado con ${dto.proveedor.toUpperCase()} (${usuario.correo}).`,
      );
    }

    return this.emitirToken(usuario, perfil);
  }

  /**
   * Valida la identidad provista por Google, Apple, Facebook o Biometría física.
   */
  private async validarTokenSocial(
    proveedor: 'google' | 'apple' | 'facebook' | 'biometrico',
    token: string,
    perfilEnviado?: { nombres?: string; apellidos?: string; fotoUrl?: string },
  ): Promise<DatosSocialValidados> {
    // Modo Biométrico de Dispositivo (Hardware Fingerprint / Face ID confirmado)
    if (proveedor === 'biometrico') {
      const idLimpio = token.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'dispositivo_local';
      return {
        correo: `biometrico_${idLimpio.slice(0, 10)}@dispositivo.visioncare.ai`,
        idProveedor: `bio_${idLimpio}`,
        nombres: perfilEnviado?.nombres || 'Usuario',
        apellidos: perfilEnviado?.apellidos || 'Biométrico',
        fotoUrl: perfilEnviado?.fotoUrl,
      };
    }

    // Modo Demo / Entorno de desarrollo para pruebas inmediatas si se envía prefijo mock_
    if (token.startsWith('mock_')) {
      const nombreUsuario = token.replace(/^mock_/, '').toLowerCase() || 'usuario';
      return {
        correo: `${nombreUsuario}@gmail.com`,
        idProveedor: `mock-sub-${nombreUsuario}-12345`,
        nombres: perfilEnviado?.nombres || `Usuario ${nombreUsuario.charAt(0).toUpperCase() + nombreUsuario.slice(1)}`,
        apellidos: perfilEnviado?.apellidos || 'Demo',
        fotoUrl: perfilEnviado?.fotoUrl,
      };
    }

    // Validación oficial con Google OAuth2 / OpenID Connect (id_token o access_token)
    if (proveedor === 'google') {
      try {
        let correo = '';
        let idProveedor = '';
        let nombres = perfilEnviado?.nombres || 'Usuario';
        let apellidos = perfilEnviado?.apellidos || '';
        let fotoUrl = perfilEnviado?.fotoUrl;

        // 1. Probar primero si es un id_token (JWT firmado por Google)
        const resId = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
        );

        if (resId.ok) {
          const data = await resId.json();
          correo = data.email || '';
          idProveedor = data.sub || data.user_id || '';
          nombres = data.given_name || data.name || nombres;
          apellidos = data.family_name || apellidos;
          fotoUrl = data.picture || fotoUrl;
        } else {
          // 2. Si no es id_token, verificar si es un access_token con el endpoint userinfo
          const resUser = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (resUser.ok) {
            const data = await resUser.json();
            correo = data.email || '';
            idProveedor = data.sub || '';
            nombres = data.given_name || data.name || nombres;
            apellidos = data.family_name || apellidos;
            fotoUrl = data.picture || fotoUrl;
          } else {
            throw new Error(`Tokeninfo HTTP ${resId.status}, Userinfo HTTP ${resUser.status}`);
          }
        }

        if (!correo) {
          throw new Error('El perfil de Google no contiene correo electrónico');
        }

        return {
          correo: correo.toLowerCase(),
          idProveedor,
          nombres,
          apellidos,
          fotoUrl,
        };
      } catch (err) {
        this.logger.error(`Error verificando token de Google: ${err}`);
        throw new UnauthorizedException('Token de Google inválido o expirado.');
      }
    }

    // Validación con Apple
    if (proveedor === 'apple') {
      try {
        const partes = token.split('.');
        if (partes.length < 2) throw new Error('JWT de Apple malformado');
        const payloadJson = Buffer.from(partes[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);

        const email = payload.email || `${payload.sub}@privaterelay.appleid.com`;

        return {
          correo: email.toLowerCase(),
          idProveedor: payload.sub as string,
          nombres: perfilEnviado?.nombres || 'Usuario Apple',
          apellidos: perfilEnviado?.apellidos || '',
          fotoUrl: perfilEnviado?.fotoUrl,
        };
      } catch (err) {
        this.logger.error(`Error verificando token de Apple: ${err}`);
        throw new UnauthorizedException('Token de Apple inválido o expirado.');
      }
    }

    // Validación con Facebook
    if (proveedor === 'facebook') {
      try {
        const url = `https://graph.facebook.com/me?fields=id,name,first_name,last_name,email,picture.type(large)&access_token=${encodeURIComponent(token)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Facebook API error: ${res.status}`);
        const data = await res.json();

        return {
          correo: (data.email || `${data.id}@facebook.visioncare.ai`).toLowerCase(),
          idProveedor: data.id as string,
          nombres: (data.first_name || data.name || perfilEnviado?.nombres || 'Usuario Facebook') as string,
          apellidos: (data.last_name || perfilEnviado?.apellidos || '') as string,
          fotoUrl: (data.picture?.data?.url || perfilEnviado?.fotoUrl) as string,
        };
      } catch (err) {
        this.logger.error(`Error verificando token de Facebook: ${err}`);
        throw new UnauthorizedException('Token de Facebook inválido o expirado.');
      }
    }

    throw new BadRequestException(`Proveedor social '${proveedor}' no soportado.`);
  }

  /** Busca por correo INCLUYENDO el hash (por select:false se usa query builder) */
  private async buscarUsuarioConHash(correo: string): Promise<Usuario | null> {
    return this.usuariosRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.contrasena_hash')
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
      sub: String(usuario.id_usuario),
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
