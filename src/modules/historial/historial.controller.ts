import { Controller, Get, Param, Query } from '@nestjs/common';
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
  ActividadResponseDto,
  HistorialQueryDto,
  ResumenActividadDto,
} from './dto';
import { HistorialService } from './historial.service';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de historial (requieren JWT):
 *
 *   GET /historial               → mi feed (consolidado por defecto)
 *   GET /historial/resumen       → conteos por tipo (dashboard)
 *   GET /historial/usuario/:id   → historial de un usuario
 *                                  (CU37 web — ADMIN/INSTITUCION)
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Historial')
@ApiBearerAuth('JWT-auth')
@Controller('historial')
export class HistorialController {
  constructor(private readonly historialService: HistorialService) {}

  @Get()
  @ApiOperation({
    summary:
      'CU37/CU23 — Mi historial de actividades (feed consolidado por defecto)',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado consolidado.' })
  listar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() query: HistorialQueryDto,
  ): Promise<RespuestaPaginada<ActividadResponseDto>> {
    return this.historialService.listar(idUsuario, query);
  }

  @Get('resumen')
  @ApiOperation({
    summary: 'Conteos de mis actividades por tipo y fuente (dashboard)',
  })
  @ApiResponse({ status: 200, type: [ResumenActividadDto] })
  resumen(
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<ResumenActividadDto[]> {
    return this.historialService.resumen(idUsuario);
  }

  @Get('usuario/:id')
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({
    summary: 'CU37 — Historial de un usuario específico (ADMIN/INSTITUCION)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN o INSTITUCION.' })
  listarPorUsuario(
    @Param('id', ParseIdPipe) id: number,
    @Query() query: HistorialQueryDto,
  ): Promise<RespuestaPaginada<ActividadResponseDto>> {
    return this.historialService.listarPorUsuario(id, query);
  }
}