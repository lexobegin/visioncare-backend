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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators';
import { ParseIdPipe } from '../../common/pipes';
import { VisioncoachService } from './visioncoach.service';
import {
  ActualizarDesafioDto,
  CategoriaResponseDto,
  DesafioResponseDto,
  EjercicioResponseDto,
  EjerciciosQueryDto,
  FinalizarSesionDto,
  InsigniaResponseDto,
  ProgresoResponseDto,
  RegistrarResultadoDto,
  ResultadoRegistradoDto,
  SesionFinalizadaDto,
  SesionResponseDto,
} from './dto';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de VisionCoach (móvil, todos autenticados):
 *
 *   CATÁLOGO (CU27):
 *     GET  /visioncoach/categorias          → categorías activas
 *     GET  /visioncoach/ejercicios          → catálogo filtrable
 *     GET  /visioncoach/ejercicios/:id      → detalle
 *
 *   SESIONES (CU28–CU30):
 *     POST /visioncoach/sesiones            → iniciar sesión
 *     POST /visioncoach/sesiones/:id/resultados  → registrar resultado
 *     PATCH /visioncoach/sesiones/:id/finalizar  → completar/abandonar
 *
 *   PROGRESO Y GAMIFICACIÓN (CU30–CU33):
 *     GET   /visioncoach/progreso           → nivel, puntos, rachas
 *     GET   /visioncoach/desafios           → desafíos adaptativos
 *     PATCH /visioncoach/desafios/:id       → EN_CURSO/COMPLETADO/OMITIDO
 *     GET   /visioncoach/insignias          → catálogo
 *     GET   /visioncoach/insignias/mias     → mis insignias
 * ══════════════════════════════════════════════════════
 */
@ApiTags('VisionCoach')
@ApiBearerAuth('JWT-auth')
@Controller('visioncoach')
export class VisioncoachController {
  constructor(private readonly visioncoachService: VisioncoachService) {}

  // ═══════════════════ CATÁLOGO ═══════════════════

  @Get('categorias')
  @ApiOperation({ summary: 'CU27 — Categorías de ejercicios activas' })
  @ApiResponse({ status: 200, type: CategoriaResponseDto, isArray: true })
  listarCategorias(): Promise<CategoriaResponseDto[]> {
    return this.visioncoachService.listarCategorias();
  }

  @Get('ejercicios')
  @ApiOperation({ summary: 'CU27 — Catálogo de ejercicios (filtros opcionales)' })
  @ApiResponse({ status: 200, type: EjercicioResponseDto, isArray: true })
  listarEjercicios(
    @Query() query: EjerciciosQueryDto,
  ): Promise<EjercicioResponseDto[]> {
    return this.visioncoachService.listarEjercicios(query);
  }

  @Get('ejercicios/:id')
  @ApiOperation({ summary: 'CU27 — Detalle de un ejercicio' })
  @ApiParam({ name: 'id', example: 3 })
  @ApiResponse({ status: 200, type: EjercicioResponseDto })
  @ApiResponse({ status: 404, description: 'Ejercicio no encontrado.' })
  obtenerEjercicio(
    @Param('id', ParseIdPipe) id: number,
  ): Promise<EjercicioResponseDto> {
    return this.visioncoachService.obtenerEjercicio(id);
  }

  // ═══════════════════ SESIONES ═══════════════════

  @Post('sesiones')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'CU28 — Iniciar sesión de entrenamiento' })
  @ApiResponse({ status: 201, type: SesionResponseDto })
  iniciarSesion(
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<SesionResponseDto> {
    return this.visioncoachService.iniciarSesion(idUsuario);
  }

  @Post('sesiones/:id/resultados')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'CU29 — Registrar resultado de un ejercicio (puntos server-side)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 201, type: ResultadoRegistradoDto })
  @ApiResponse({
    status: 400,
    description: 'Sesión finalizada o datos inválidos.',
  })
  registrarResultado(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: RegistrarResultadoDto,
  ): Promise<ResultadoRegistradoDto> {
    return this.visioncoachService.registrarResultado(id, dto, idUsuario);
  }

  @Patch('sesiones/:id/finalizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'CU30 — Finalizar sesión (dispara adaptación CU31 + insignias CU33)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: SesionFinalizadaDto })
  @ApiResponse({
    status: 400,
    description: 'La sesión ya fue finalizada.',
  })
  finalizarSesion(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: FinalizarSesionDto,
  ): Promise<SesionFinalizadaDto> {
    return this.visioncoachService.finalizarSesion(id, dto, idUsuario);
  }

  // ═══════════════════ PROGRESO / DESAFÍOS / INSIGNIAS ═══════════════════

  @Get('progreso')
  @ApiOperation({ summary: 'CU30 — Mi progreso (nivel, puntos, rachas)' })
  @ApiResponse({ status: 200, type: ProgresoResponseDto })
  obtenerProgreso(
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<ProgresoResponseDto> {
    return this.visioncoachService.obtenerProgreso(idUsuario);
  }

  @Get('desafios')
  @ApiOperation({ summary: 'CU31 — Mis desafíos adaptativos (últimos 20)' })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['ASIGNADO', 'EN_CURSO', 'COMPLETADO', 'OMITIDO'],
  })
  @ApiResponse({ status: 200, type: DesafioResponseDto, isArray: true })
  listarDesafios(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query('estado') estado?: string,
  ): Promise<DesafioResponseDto[]> {
    return this.visioncoachService.listarDesafios(idUsuario, estado);
  }

  @Patch('desafios/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CU31 — Actualizar estado de un desafío propio' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: DesafioResponseDto })
  @ApiResponse({ status: 404, description: 'Desafío no encontrado (o ajeno).' })
  actualizarDesafio(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: ActualizarDesafioDto,
  ): Promise<DesafioResponseDto> {
    return this.visioncoachService.actualizarDesafio(id, dto, idUsuario);
  }

  @Get('insignias/mias')
  @ApiOperation({ summary: 'CU33 — Mis insignias (con fecha de obtención)' })
  @ApiResponse({ status: 200, type: InsigniaResponseDto, isArray: true })
  listarMisInsignias(
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<InsigniaResponseDto[]> {
    return this.visioncoachService.listarMisInsignias(idUsuario);
  }

  @Get('insignias')
  @ApiOperation({ summary: 'CU33 — Catálogo de insignias' })
  @ApiResponse({ status: 200, type: InsigniaResponseDto, isArray: true })
  listarInsignias(): Promise<InsigniaResponseDto[]> {
    return this.visioncoachService.listarInsignias();
  }
}
