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

import { CurrentUser } from '../../common/decorators';
import { RespuestaPaginada } from '../../common/dto/pagination.dto';
import { ParseIdPipe } from '../../common/pipes';
import { NavegacionService } from './navegacion.service';
import {
  AgregarPuntoDto,
  CrearNavegacionDto,
  FinalizarNavegacionDto,
  NavegacionQueryDto,
  NavegacionResponseDto,
} from './dto';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de navegación asistida (CU24 — móvil):
 *
 *   POST   /navegaciones              → iniciar (origen/destino/modo)
 *   POST   /navegaciones/:id/puntos   → registrar punto GPS de la traza
 *   PATCH  /navegaciones/:id/finalizar → COMPLETADA / CANCELADA / ERROR
 *   GET    /navegaciones              → mis navegaciones (paginado)
 *   GET    /navegaciones/:id          → detalle (traza + distancia + duración)
 *
 * Solo el dueño accede a su navegación (valida el service).
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Navegación')
@ApiBearerAuth('JWT-auth')
@Controller('navegaciones')
export class NavegacionController {
  constructor(private readonly navegacionService: NavegacionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'CU24 — Iniciar navegación asistida' })
  @ApiResponse({ status: 201, type: NavegacionResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  iniciar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: CrearNavegacionDto,
  ): Promise<NavegacionResponseDto> {
    return this.navegacionService.iniciar(idUsuario, dto);
  }

  @Get()
  @ApiOperation({ summary: 'CU24/CU23 — Mis navegaciones (paginado)' })
  @ApiResponse({ status: 200, type: NavegacionResponseDto, isArray: true })
  listarMis(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() query: NavegacionQueryDto,
  ): Promise<RespuestaPaginada<NavegacionResponseDto>> {
    return this.navegacionService.listar(idUsuario, query);
  }

  @Post(':id/puntos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'CU24 — Registrar un punto GPS en la traza (orden automático)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 201, type: NavegacionResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Navegación finalizada u orden duplicado.',
  })
  agregarPunto(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: AgregarPuntoDto,
  ): Promise<NavegacionResponseDto> {
    return this.navegacionService.agregarPunto(id, dto, idUsuario);
  }

  @Patch(':id/finalizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CU24 — Finalizar navegación (COMPLETADA/CANCELADA/ERROR)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: NavegacionResponseDto })
  @ApiResponse({
    status: 400,
    description: 'La navegación ya fue finalizada.',
  })
  finalizar(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: FinalizarNavegacionDto,
  ): Promise<NavegacionResponseDto> {
    return this.navegacionService.finalizar(id, dto, idUsuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'CU24 — Detalle de mi navegación (traza + métricas)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: NavegacionResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Navegación no encontrada (o ajena).',
  })
  obtenerPorId(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<NavegacionResponseDto> {
    return this.navegacionService.obtenerPorId(id, idUsuario);
  }
}
