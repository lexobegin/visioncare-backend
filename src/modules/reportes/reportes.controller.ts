import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { ReportesService } from './reportes.service';
import {
  DescargaReporteDto,
  GenerarReporteDto,
  ReporteQueryDto,
  ReporteResponseDto,
} from './dto';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de reportes (CU39 — panel web):
 *
 *   POST   /reportes                → generar (ADMIN/INSTITUCION)
 *   GET    /reportes                → listar (ADMIN: todo · INSTITUCION: lo suyo)
 *   GET    /reportes/:id            → detalle con datos JSONB
 *   GET    /reportes/:id/descargar  → URL del CSV en R2 (si lo tiene)
 *   DELETE /reportes/:id            → eliminar (solo ADMIN)
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Reportes')
@ApiBearerAuth('JWT-auth')
@Roles('ADMIN', 'INSTITUCION')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'CU39 — Generar reporte (JSON o CSV)' })
  @ApiResponse({ status: 201, type: ReporteResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Formato no disponible, periodo inválido o sin institución.',
  })
  generar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: GenerarReporteDto,
  ): Promise<ReporteResponseDto> {
    return this.reportesService.generar(idUsuario, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar reportes (ADMIN: todos · INSTITUCION: los suyos)',
  })
  @ApiResponse({ status: 200, type: ReporteResponseDto, isArray: true })
  listar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() query: ReporteQueryDto,
  ): Promise<RespuestaPaginada<ReporteResponseDto>> {
    return this.reportesService.listar(idUsuario, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un reporte (incluye datos JSONB)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: ReporteResponseDto })
  @ApiResponse({ status: 403, description: 'Reporte de otra institución.' })
  @ApiResponse({ status: 404, description: 'Reporte no encontrado.' })
  obtenerPorId(
    @CurrentUser('id_usuario') idUsuario: number,
    @Param('id', ParseIdPipe) id: number,
  ): Promise<ReporteResponseDto> {
    return this.reportesService.obtenerPorId(idUsuario, id);
  }

  @Get(':id/descargar')
  @ApiOperation({ summary: 'URL de descarga del CSV en R2 (si lo tiene)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: DescargaReporteDto })
  @ApiResponse({
    status: 400,
    description: 'El reporte es JSON (sin archivo): los datos están en el detalle.',
  })
  descargar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Param('id', ParseIdPipe) id: number,
  ): Promise<DescargaReporteDto> {
    return this.reportesService.descargar(idUsuario, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Eliminar reporte (solo ADMIN)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({
    status: 200,
    schema: { example: { eliminado: true } },
  })
  eliminar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Param('id', ParseIdPipe) id: number,
  ): Promise<{ eliminado: boolean }> {
    return this.reportesService.eliminar(idUsuario, id);
  }
}
