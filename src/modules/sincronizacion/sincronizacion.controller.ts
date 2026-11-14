import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators';
import { RespuestaPaginada } from '../../common/dto/pagination.dto';
import {
  BajarSincronizacionDto,
  BajarResultadoDto,
  SincronizacionQueryDto,
  SincronizacionResponseDto,
  SubirResultadoDto,
  SubirSincronizacionDto,
} from './dto';
import { SincronizacionService } from './sincronizacion.service';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de sincronización offline (móvil):
 *
 *   POST /sincronizacion/subir  → CU25: lote de cambios offline
 *                                 (resultado por cambio, idempotente)
 *   POST /sincronizacion/bajar  → CU26: datos desde la última
 *                                 sincronización (cache del móvil)
 *   GET  /sincronizacion        → bitácora propia (paginada)
 *
 * Todos autenticados: cada usuario sincroniza SOLO sus datos.
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Sincronización')
@ApiBearerAuth('JWT-auth')
@Controller('sincronizacion')
export class SincronizacionController {
  constructor(private readonly sincronizacionService: SincronizacionService) {}

  @Post('subir')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'CU25 — Subir lote de cambios offline (hasta 100, idempotente)',
  })
  @ApiResponse({ status: 201, type: SubirResultadoDto })
  @ApiResponse({ status: 400, description: 'Lote malformado.' })
  subir(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: SubirSincronizacionDto,
  ): Promise<SubirResultadoDto> {
    return this.sincronizacionService.subir(idUsuario, dto);
  }

  @Post('bajar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'CU26 — Descargar datos propios desde la última sincronización',
  })
  @ApiResponse({ status: 200, type: BajarResultadoDto })
  bajar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: BajarSincronizacionDto,
  ): Promise<BajarResultadoDto> {
    return this.sincronizacionService.bajar(idUsuario, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Bitácora de mis sincronizaciones (paginada)' })
  @ApiResponse({ status: 200, type: SincronizacionResponseDto, isArray: true })
  listarMis(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() query: SincronizacionQueryDto,
  ): Promise<RespuestaPaginada<SincronizacionResponseDto>> {
    return this.sincronizacionService.listar(idUsuario, query);
  }
}
