import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators';
import { RespuestaPaginada } from '../../common/dto/pagination.dto';
import { ParseIdPipe } from '../../common/pipes';
import {
  ActualizarContactoDto,
  ContactoQueryDto,
  ContactoResponseDto,
  CrearContactoDto,
} from './dto';
import { ContactosService } from './contactos.service';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de contactos de confianza (requieren JWT):
 *
 *   PROPIOS (CU05 — cualquier usuario autenticado):
 *     POST   /contactos           → crear mi contacto
 *     GET    /contactos           → mis contactos (paginado, por prioridad)
 *     GET    /contactos/:id       → detalle (solo si es mío)
 *     PATCH  /contactos/:id       → actualizar (solo si es mío)
 *     DELETE /contactos/:id       → desactivar (solo si es mío)
 *     PATCH  /contactos/:id/activar → reactivar
 *
 *   ADMINISTRACIÓN (CU36 — ADMIN/INSTITUCION):
 *     GET    /contactos/usuario/:id → contactos de un usuario
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Contactos de Confianza')
@ApiBearerAuth('JWT-auth')
@Controller('contactos')
export class ContactosController {
  constructor(private readonly contactosService: ContactosService) {}

  @Post()
  @ApiOperation({ summary: 'CU05 — Crear mi contacto de confianza' })
  @ApiResponse({ status: 201, type: ContactoResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Debe tener al menos un teléfono o un correo.',
  })
  crear(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: CrearContactoDto,
  ): Promise<ContactoResponseDto> {
    return this.contactosService.crear(idUsuario, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'CU05 — Mis contactos (paginados, ordenados por prioridad)',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  listarMisContactos(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() query: ContactoQueryDto,
  ): Promise<RespuestaPaginada<ContactoResponseDto>> {
    return this.contactosService.listar(idUsuario, query);
  }

  @Get('usuario/:id')
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({
    summary: 'CU36 — Contactos de un usuario específico (ADMIN/INSTITUCION)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  listarPorUsuario(
    @Param('id', ParseIdPipe) id: number,
    @Query() query: ContactoQueryDto,
  ): Promise<RespuestaPaginada<ContactoResponseDto>> {
    return this.contactosService.listarPorUsuario(id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'CU05 — Ver detalle de mi contacto' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: ContactoResponseDto })
  @ApiResponse({ status: 404, description: 'Contacto no encontrado (o ajeno).' })
  obtenerPorId(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<ContactoResponseDto> {
    return this.contactosService.obtenerPorId(id, idUsuario);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'CU05 — Actualizar mi contacto' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: ContactoResponseDto })
  @ApiResponse({ status: 400, description: 'Sin campos o quedó sin ningún medio de contacto.' })
  actualizar(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: ActualizarContactoDto,
  ): Promise<ContactoResponseDto> {
    return this.contactosService.actualizar(id, idUsuario, dto);
  }

  @Patch(':id/activar')
  @ApiOperation({ summary: 'CU05 — Reactivar mi contacto' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Contacto activado.' })
  activar(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<{ mensaje: string }> {
    return this.contactosService.activar(id, idUsuario);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CU05 — Desactivar mi contacto (borrado lógico)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Contacto desactivado.' })
  @ApiResponse({ status: 404, description: 'Contacto no encontrado (o ajeno).' })
  desactivar(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<{ mensaje: string }> {
    return this.contactosService.desactivar(id, idUsuario);
  }
}