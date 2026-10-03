import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { PaginationDto, RespuestaPaginada } from '../../common/dto/pagination.dto';
import {
  ComandoHistorialDto,
  ComandoVozResponseDto,
  IntencionCatalogoDto,
  InterpretarComandoDto,
} from './dto';
import { VozService } from './voz.service';
import { INTENCIONES_VOZ } from './voz.intenciones';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de comandos de voz (requieren JWT):
 *
 *   POST /voz/interpretar  → CU06: interpreta el texto (STT)
 *                            y devuelve acción + respuesta TTS
 *   GET  /voz/intenciones  → catálogo de intenciones disponibles
 *                            (útil para la app móvil)
 *   GET  /voz/historial    → mis comandos ejecutados (paginado)
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Voz')
@ApiBearerAuth('JWT-auth')
@Controller('voz')
export class VozController {
  constructor(private readonly vozService: VozService) {}

  @Post('interpretar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'CU06 — Interpretar un comando de voz (texto STT) y devolver la acción a ejecutar',
  })
  @ApiBody({ type: InterpretarComandoDto })
  @ApiResponse({ status: 200, type: ComandoVozResponseDto })
  @ApiResponse({ status: 400, description: 'Comando vacío o inválido.' })
  interpretar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: InterpretarComandoDto,
  ): Promise<ComandoVozResponseDto> {
    return this.vozService.interpretar(idUsuario, dto);
  }

  @Get('intenciones')
  @ApiOperation({
    summary: 'Catálogo de intenciones de voz disponibles (para la app móvil)',
  })
  @ApiResponse({ status: 200, type: [IntencionCatalogoDto] })
  listarIntenciones(): IntencionCatalogoDto[] {
    return INTENCIONES_VOZ.map((i) => ({
      codigo: i.codigo,
      caso_uso: i.casoUso,
      descripcion: i.descripcion,
      ejemplos: i.ejemplos,
      accion_app: i.accionApp,
    }));
  }

  @Get('historial')
  @ApiOperation({
    summary: 'Mi historial de comandos de voz (paginado, filtrable)',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  listarHistorial(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() query: PaginationDto & { intencion?: string },
  ): Promise<RespuestaPaginada<ComandoHistorialDto>> {
    return this.vozService.listarHistorial(idUsuario, query);
  }
}