import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ParseIdPipe } from '../../common/pipes';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser, Roles } from '../../common/decorators';
import { PaginationDto, RespuestaPaginada } from '../../common/dto/pagination.dto';
import {
  ActualizarPerfilDto,
  AdminActualizarUsuarioDto,
  CambiarContrasenaDto,
  UsuarioResponseDto,
} from './dto';
import { UsuariosService } from './usuarios.service';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de usuarios (todos requieren token JWT):
 *
 *   PERFIL PROPIO (CU04 — cualquier usuario autenticado):
 *     GET   /usuarios/me                → mi perfil
 *     PATCH /usuarios/me                → editar mi perfil
 *     PATCH /usuarios/me/contrasena     → cambiar mi contraseña
 *
 *   ADMINISTRACIÓN (CU34–CU35 — ADMIN / INSTITUCION):
 *     GET    /usuarios                  → listado paginado
 *     GET    /usuarios/:id              → detalle
 *     PATCH  /usuarios/:id              → actualizar (solo ADMIN)
 *     DELETE /usuarios/:id              → desactivar (solo ADMIN)
 *
 * ⚠️ Las rutas 'me' van ANTES que ':id' para que NestJS
 *    no interprete "me" como un id.
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Usuarios')
@ApiBearerAuth('JWT-auth')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  // ═══════════════ PERFIL PROPIO ═══════════════

  @Get('me')
  @ApiOperation({ summary: 'CU04 — Obtener mi perfil (usuario autenticado)' })
  @ApiResponse({ status: 200, type: UsuarioResponseDto })
  obtenerMiPerfil(
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.obtenerPerfil(idUsuario);
  }

  @Patch('me')
  @ApiOperation({ summary: 'CU04 — Actualizar mi perfil (nombres, contacto, idioma)' })
  @ApiResponse({ status: 200, type: UsuarioResponseDto })
  @ApiResponse({ status: 400, description: 'Sin campos para actualizar.' })
  actualizarMiPerfil(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: ActualizarPerfilDto,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.actualizarPerfilPropio(idUsuario, dto);
  }

  @Patch('me/contrasena')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CU04 — Cambiar mi contraseña (exige la actual)' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada.' })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta.' })
  cambiarMiContrasena(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: CambiarContrasenaDto,
  ): Promise<{ mensaje: string }> {
    return this.usuariosService.cambiarContrasena(idUsuario, dto);
  }

  // ═══════════════ ADMINISTRACIÓN ═══════════════

  @Get()
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({
    summary: 'CU34 — Listar usuarios (paginado, búsqueda libre)',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  listar(
    @Query() paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<UsuarioResponseDto>> {
    return this.usuariosService.listar(paginacion);
  }

  @Get(':id')
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({ summary: 'CU34/CU35 — Ver detalle de un usuario' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: UsuarioResponseDto })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  obtenerPorId(
    @Param('id', ParseIdPipe) id: number,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.obtenerPorId(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'CU34 — Actualizar correo/rol/estado/institución (solo ADMIN)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: UsuarioResponseDto })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN.' })
  actualizarComoAdmin(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: AdminActualizarUsuarioDto,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.actualizarComoAdmin(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'CU34 — Desactivar usuario (borrado lógico, solo ADMIN)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Usuario desactivado.' })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN.' })
  desactivar(
    @Param('id', ParseIdPipe) id: number,
  ): Promise<{ mensaje: string }> {
    return this.usuariosService.desactivar(id);
  }
}