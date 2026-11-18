import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { LoginDto, RegistroDto, SocialLoginDto, TokenResponseDto } from './dto';
import { AuthService } from './auth.service';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de autenticación (públicos):
 *
 *   POST /api/v1/auth/registro      → CU01 (crear cuenta + perfil)
 *   POST /api/v1/auth/login         → CU02 (obtener token JWT con contraseña)
 *   POST /api/v1/auth/social-login  → CU02 (Google One Tap, Apple, Facebook)
 *
 * Rate limiting reforzado: son endpoints sensibles a ataques
 * de fuerza bruta, por eso tienen límites más estrictos que
 * el global (100/min).
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * CU01 — Registro de usuario.
   * Crea la cuenta (rol USUARIO) + su perfil y devuelve el token
   * (auto-login: el usuario no necesita loguearse inmediatamente).
   */
  @Public()
  @Post('registro')
  @HttpCode(HttpStatus.CREATED)
  // Máx. 10 registros por minuto por IP
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'CU01 — Registrar usuario (crea cuenta + perfil, devuelve token)',
  })
  @ApiBody({ type: RegistroDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Usuario registrado. Token emitido.',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'El correo ya está registrado.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos inválidos (ver detalles en la respuesta).',
  })
  async registrar(@Body() dto: RegistroDto): Promise<TokenResponseDto> {
    return this.authService.registrar(dto);
  }

  /**
   * CU02 — Inicio de sesión con credenciales.
   * Valida credenciales y devuelve el token JWT.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Máx. 5 intentos por minuto por IP (protección fuerza bruta)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'CU02 — Iniciar sesión con credenciales tradicionales',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login exitoso. Token emitido.',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Credenciales inválidas.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cuenta bloqueada o inactiva.',
  })
  async login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(dto);
  }

  /**
   * CU02 (Social) — Inicio de sesión / Registro en un toque con Google, Apple o Facebook.
   * Fricción Cero: Valida el token del proveedor social y autentica o crea la cuenta.
   */
  @Public()
  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  // Máx. 15 intentos por minuto por IP
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({
    summary: 'CU02 — Iniciar sesión o registro en un toque (Google, Apple, Facebook)',
  })
  @ApiBody({ type: SocialLoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Autenticación social exitosa. Token JWT de VisionCare emitido.',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token del proveedor inválido o expirado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cuenta bloqueada o inactiva.',
  })
  async socialLogin(@Body() dto: SocialLoginDto): Promise<TokenResponseDto> {
    return this.authService.loginSocial(dto);
  }
}
