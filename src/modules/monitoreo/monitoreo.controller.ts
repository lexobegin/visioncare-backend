import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../common/decorators';
import { RespuestaPaginada } from '../../common/dto/pagination.dto';
import { MonitoreoService } from './monitoreo.service';
import {
  ConsultarRegistrosDto,
  RegistroResponseDto,
} from './dto';
import { ModeloIa } from './entities/modelo-ia.entity';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de monitoreo IA (CU40 — web, roles):
 *
 *   GET /monitoreo/modelos   → catálogo de modelos desplegados
 *   GET /monitoreo/registros → ejecuciones IA (filtros + paginación)
 *   GET /monitoreo/resumen   → agregados para el dashboard
 *
 * Autenticación y rate-limit son globales (APP_GUARD); solo se
 * declara la autorización por roles.
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Monitoreo IA')
@ApiBearerAuth('JWT-auth')
@Roles('ADMIN', 'INSTITUCION')
@Controller('monitoreo')
export class MonitoreoController {
  constructor(private readonly monitoreoService: MonitoreoService) {}

  @Get('modelos')
  @ApiOperation({
    summary: 'CU40 — Catálogo de modelos desplegados en el servicio IA',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['ACTIVO', 'INACTIVO', 'PRUEBA'],
  })
  @ApiResponse({ status: 200, type: ModeloIa, isArray: true })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN o INSTITUCION.' })
  listarModelos(@Query('estado') estado?: string): Promise<ModeloIa[]> {
    return this.monitoreoService.listarModelos(estado);
  }

  @Get('registros')
  @ApiOperation({
    summary: 'CU40 — Registros de ejecución IA (paginado y filtrado)',
  })
  @ApiResponse({ status: 200, type: RegistroResponseDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN o INSTITUCION.' })
  listarRegistros(
    @Query() query: ConsultarRegistrosDto,
  ): Promise<RespuestaPaginada<RegistroResponseDto>> {
    return this.monitoreoService.listarRegistros(query);
  }

  @Get('resumen')
  @ApiOperation({
    summary: 'CU40 — Agregados para el dashboard de monitoreo',
  })
  @ApiQuery({ name: 'fecha_desde', required: false, example: '2026-11-01' })
  @ApiQuery({ name: 'fecha_hasta', required: false, example: '2026-11-12' })
  @ApiResponse({ status: 200, description: 'Agregados del periodo.' })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN o INSTITUCION.' })
  resumen(
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
  ) {
    return this.monitoreoService.resumen(fechaDesde, fechaHasta);
  }
}
