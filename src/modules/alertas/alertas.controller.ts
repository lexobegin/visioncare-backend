import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  AlertaQueryDto,
  AlertaResponseDto,
  AtenderLoteDto,
  ResumenAlertasDto,
} from './dto';
import { AlertasService } from './alertas.service';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de alertas (requieren JWT):
 *
 *   MÓVIL (HU18/HU19):
 *     GET   /alertas/pendientes     → sin atender (prioridad DESC)
 *     PATCH /alertas/atender-lote   → marcar N reproducidas
 *     PATCH /alertas/:id/atender    → marcar una
 *
 *   HISTORIAL / DASHBOARD:
 *     GET /alertas                  → mi historial (filtros)
 *     GET /alertas/resumen          → conteos (nivel/tipo/hoy)
 *     GET /alertas/usuario/:id      → de otro usuario (ADMIN/INSTITUCION)
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Alertas')
@ApiBearerAuth('JWT-auth')
@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get('pendientes')
  @ApiOperation({
    summary:
      'HU18 — Mis alertas sin atender (prioridad DESC: CRITICO primero)',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  listarPendientes(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<AlertaResponseDto>> {
    return this.alertasService.listarPendientes(idUsuario, paginacion);
  }

  @Patch('atender-lote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'HU18 — Marcar N alertas como atendidas (tras reproducirlas en la app)',
  })
  @ApiResponse({ status: 200, description: 'Cantidad atendida.' })
  atenderLote(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: AtenderLoteDto,
  ): Promise<{ atendidas: number }> {
    return this.alertasService.atenderLote(dto, idUsuario);
  }

  @Patch(':id/atender')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'HU18 — Marcar una alerta como atendida' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Alerta atendida.' })
  @ApiResponse({ status: 404, description: 'Alerta no encontrada (o ajena).' })
  atender(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<{ mensaje: string }> {
    return this.alertasService.atender(id, idUsuario);
  }

  @Get('resumen')
  @ApiOperation({
    summary: 'Conteos de mis alertas por nivel/tipo + pendientes + hoy',
  })
  @ApiResponse({ status: 200, type: ResumenAlertasDto })
  resumen(
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<ResumenAlertasDto> {
    return this.alertasService.resumen(idUsuario);
  }

  @Get('usuario/:id')
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({
    summary: 'CU38 — Historial de alertas de un usuario (ADMIN/INSTITUCION)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN o INSTITUCION.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  listarPorUsuario(
    @Param('id', ParseIdPipe) id: number,
    @Query() query: AlertaQueryDto,
  ): Promise<RespuestaPaginada<AlertaResponseDto>> {
    return this.alertasService.listarPorUsuario(id, query);
  }

  @Get()
  @ApiOperation({
    summary: 'Mi historial de alertas (filtros: nivel, tipo, atendida, búsqueda)',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  listar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() query: AlertaQueryDto,
  ): Promise<RespuestaPaginada<AlertaResponseDto>> {
    return this.alertasService.listar(idUsuario, query);
  }
}