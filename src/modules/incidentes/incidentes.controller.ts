import {
  BadRequestException,
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
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser, Roles } from '../../common/decorators';
import type { UsuarioJwt } from '../../common/decorators';
import { RespuestaPaginada } from '../../common/dto/pagination.dto';
import { ParseIdPipe } from '../../common/pipes';
import { IncidentesService } from './incidentes.service';
import {
  ActualizarIncidenteDto,
  CrearIncidenteDto,
  IncidenteQueryDto,
  IncidenteResponseDto,
} from './dto';

/** Tamaño máximo por evidencia (10 MB, igual que capturas) */
const TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024;

/** MIME types de evidencias que acepta el módulo */
const MIME_EVIDENCIAS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'application/pdf',
];

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de incidentes (requieren JWT):
 *
 *   MÓVIL (CU22):
 *     POST   /incidentes                          → reportar (con GPS + evidencias)
 *     GET    /incidentes                          → mis incidentes
 *     GET    /incidentes/:id                      → detalle (evidencias + mapa)
 *     PATCH  /incidentes/:id/estado               → marcar RESUELTO / reabrir
 *     POST   /incidentes/:id/evidencias           → agregar evidencia
 *     DELETE /incidentes/:id/evidencias/:idEvid   → quitar evidencia
 *
 *   WEB (CU38, ADMIN/INSTITUCION):
 *     GET    /incidentes/usuario/:id              → incidentes de un usuario
 *     PATCH  /incidentes/:id/estado               → ciclo completo + severidad
 *
 * Las evidencias viajan en el campo 'evidencias' del form-data
 * (hasta 5) o 'evidencia' (1, para el endpoint individual).
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Incidentes')
@ApiBearerAuth('JWT-auth')
@Controller('incidentes')
export class IncidentesController {
  constructor(private readonly incidentesService: IncidentesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'evidencias', maxCount: 5 }],
      { limits: { fileSize: TAMANIO_MAXIMO_BYTES } },
    ),
  )
  @ApiOperation({
    summary: 'CU22 — Reportar incidente (GPS + evidencias opcionales)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tipo_incidente: { type: 'string', example: 'OBSTRUCCION' },
        descripcion: { type: 'string', example: 'Puerta bloqueada' },
        severidad: {
          type: 'string',
          enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'],
        },
        latitud: { type: 'number', example: -17.7833 },
        longitud: { type: 'number', example: -63.1821 },
        precision_metros: { type: 'number', example: 12.5 },
        evidencias: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['tipo_incidente'],
    },
  })
  @ApiResponse({ status: 201, type: IncidenteResponseDto })
  @ApiResponse({ status: 400, description: 'Datos o archivos inválidos.' })
  crear(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: CrearIncidenteDto,
    @UploadedFiles() archivos?: { evidencias?: Express.Multer.File[] },
  ): Promise<IncidenteResponseDto> {
    const evidencias = archivos?.evidencias ?? [];
    this.validarMimes(evidencias);
    return this.incidentesService.crear(idUsuario, dto, evidencias);
  }

  @Get()
  @ApiOperation({ summary: 'CU22/CU23 — Mis incidentes (paginado)' })
  @ApiResponse({ status: 200, type: IncidenteResponseDto, isArray: true })
  listarMis(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() query: IncidenteQueryDto,
  ): Promise<RespuestaPaginada<IncidenteResponseDto>> {
    return this.incidentesService.listar(idUsuario, query);
  }

  @Get('usuario/:id')
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({
    summary: 'CU38 — Incidentes de un usuario (ADMIN/INSTITUCION)',
  })
  @ApiParam({ name: 'id', example: 7 })
  @ApiResponse({ status: 200, type: IncidenteResponseDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN o INSTITUCION.' })
  listarPorUsuario(
    @Param('id', ParseIdPipe) id: number,
    @Query() query: IncidenteQueryDto,
  ): Promise<RespuestaPaginada<IncidenteResponseDto>> {
    return this.incidentesService.listarPorUsuario(id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'CU22/CU38 — Detalle del incidente (dueño o gestor)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: IncidenteResponseDto })
  @ApiResponse({ status: 404, description: 'Incidente no encontrado (o ajeno).' })
  obtenerPorId(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() usuario: UsuarioJwt,
  ): Promise<IncidenteResponseDto> {
    return this.incidentesService.obtenerPorId(id, usuario);
  }

  @Patch(':id/estado')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'CU22/CU38 — Cambiar estado (usuario: RESUELTO/ABIERTO; gestor: todo + severidad)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: IncidenteResponseDto })
  @ApiResponse({ status: 403, description: 'Cambio no permitido para tu rol.' })
  actualizarEstado(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: ActualizarIncidenteDto,
    @CurrentUser() usuario: UsuarioJwt,
  ): Promise<IncidenteResponseDto> {
    return this.incidentesService.actualizarEstado(id, dto, usuario);
  }

  @Post(':id/evidencias')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('evidencia', {
      limits: { fileSize: TAMANIO_MAXIMO_BYTES },
    }),
  )
  @ApiOperation({ summary: 'CU22 — Agregar evidencia al incidente' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        evidencia: { type: 'string', format: 'binary' },
      },
      required: ['evidencia'],
    },
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 201, type: IncidenteResponseDto })
  @ApiResponse({ status: 400, description: 'Archivo faltante o inválido.' })
  agregarEvidencia(
    @Param('id', ParseIdPipe) id: number,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser() usuario: UsuarioJwt,
  ): Promise<IncidenteResponseDto> {
    if (!archivo) {
      throw new BadRequestException(
        'Debes enviar el archivo en el campo "evidencia" del formulario.',
      );
    }
    this.validarMimes([archivo]);
    return this.incidentesService.agregarEvidencia(id, archivo, usuario);
  }

  @Delete(':id/evidencias/:idEvidencia')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CU22 — Eliminar una evidencia del incidente' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiParam({ name: 'idEvidencia', example: 3 })
  @ApiResponse({ status: 200, type: IncidenteResponseDto })
  eliminarEvidencia(
    @Param('id', ParseIdPipe) id: number,
    @Param('idEvidencia', ParseIdPipe) idEvidencia: number,
    @CurrentUser() usuario: UsuarioJwt,
  ): Promise<IncidenteResponseDto> {
    return this.incidentesService.eliminarEvidencia(id, idEvidencia, usuario);
  }

  // ─── Validación de MIME de evidencias (además de los limits de multer) ───

  private validarMimes(archivos: Express.Multer.File[]): void {
    for (const archivo of archivos) {
      if (!MIME_EVIDENCIAS.includes(archivo.mimetype)) {
        throw new BadRequestException(
          `Tipo de archivo no soportado: ${archivo.mimetype}. ` +
            'Aceptados: JPEG, PNG, WEBP, MP4, WEBM, MP3, M4A, WAV, OGG, PDF.',
        );
      }
    }
  }
}
