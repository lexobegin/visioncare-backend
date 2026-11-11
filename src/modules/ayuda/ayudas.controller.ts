import {
  Body,
  Controller,
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
import { PaginationDto, RespuestaPaginada } from '../../common/dto/pagination.dto';
import { ParseIdPipe } from '../../common/pipes';
import {
  CrearSolicitudDto,
  SolicitudResponseDto,
} from './dto';
import { AyudasService } from './ayudas.service';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de ayuda (requieren JWT):
 *
 *   MÓVIL (CU20):
 *     POST  /ayuda/solicitar       → solicitud + notificación a contactos
 *     GET   /ayuda/solicitudes     → mis solicitudes
 *     GET   /ayuda/solicitudes/:id → detalle (destinatarios + ubicación)
 *     PATCH /ayuda/solicitudes/:id/atender   → "me ayudaron"
 *     PATCH /ayuda/solicitudes/:id/cancelar  → cancelar por error
 *
 *   WEB (CU38):
 *     GET   /ayuda/solicitudes/usuario/:id  → de otro usuario (roles)
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Ayuda')
@ApiBearerAuth('JWT-auth')
@Controller('ayuda')
export class AyudasController {
  constructor(private readonly ayudasService: AyudasService) {}

  @Post('solicitar')
  @HttpCode(HttpStatus.CREATED)
  // Emergencias: no aplicar throttle agresivo — 20/min es más que
  // suficiente para uso real y evita bloqueos en pánico repetido
  @ApiOperation({
    summary:
      'CU20 — Solicitar ayuda: guarda ubicación, notifica contactos autorizados',
  })
  @ApiResponse({ status: 201, type: SolicitudResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  solicitar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: CrearSolicitudDto,
  ): Promise<SolicitudResponseDto> {
    return this.ayudasService.solicitar(idUsuario, dto);
  }

  @Get('solicitudes')
  @ApiOperation({ summary: 'CU20/CU23 — Mis solicitudes de ayuda' })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  listarMisSolicitudes(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<SolicitudResponseDto>> {
    return this.ayudasService.listar(idUsuario, paginacion);
  }

  @Get('solicitudes/usuario/:id')
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({
    summary: 'CU38 — Solicitudes de un usuario (ADMIN/INSTITUCION)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN o INSTITUCION.' })
  listarPorUsuario(
    @Param('id', ParseIdPipe) id: number,
    @Query() paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<SolicitudResponseDto>> {
    return this.ayudasService.listarPorUsuario(id, paginacion);
  }

  @Get('solicitudes/:id')
  @ApiOperation({ summary: 'CU20 — Detalle de mi solicitud (con destinatarios)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: SolicitudResponseDto })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada (o ajena).' })
  obtenerPorId(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<SolicitudResponseDto> {
    return this.ayudasService.obtenerPorId(id, idUsuario);
  }

  @Patch('solicitudes/:id/atender')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CU20 — Marcar mi solicitud como atendida' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Solicitud atendida.' })
  atender(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<{ mensaje: string }> {
    return this.ayudasService.atender(id, idUsuario);
  }

  @Patch('solicitudes/:id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CU20 — Cancelar mi solicitud (por error)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Solicitud cancelada.' })
  cancelar(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<{ mensaje: string }> {
    return this.ayudasService.cancelar(id, idUsuario);
  }
}