import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { PaginationDto, RespuestaPaginada } from '../../common/dto/pagination.dto';
import { ParseIdPipe } from '../../common/pipes';
import {
  CapturaResponseDto,
  RegistrarCapturaDto,
  AnalisisContinuoDto,
  AnalisisContinuoResponseDto,
} from './dto';
import { AnalisisContinuoService } from './analisis-continuo.service';
import { CapturasService } from './capturas.service';

/** Tipos de imagen y tamaño máximo (10 MB) */
const MIME_IMAGENES = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024;

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de capturas de entorno (requieren JWT):
 *
 *   POST /capturas      → CU07 (+CU08): multipart con la imagen.
 *                         accion_app elige OCR o detección de objetos.
 *   GET  /capturas      → mis capturas (paginado, reciente primero)
 *   GET  /capturas/:id  → detalle con detecciones + resumen voz
 *
 * El archivo viaja en el campo 'imagen' del form-data.
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Capturas de Entorno')
@ApiBearerAuth('JWT-auth')
@Controller('capturas')
export class CapturasController {
  constructor(
    private readonly capturasService: CapturasService, 
    private readonly continuoService: AnalisisContinuoService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('imagen', {
      // memoryStorage: necesitamos el buffer para R2 y FastAPI
      storage: undefined, // multer default en Nest = memory
      limits: { fileSize: TAMANIO_MAXIMO_BYTES },
    }),
  )
  @ApiOperation({
    summary:
      'CU07/CU08 — Registrar captura y (opcional) reconocer objetos con IA',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagen: { type: 'string', format: 'binary' },
        accion_app: {
          type: 'string',
          enum: ['LEER_TEXTO', 'RECONOCER_OBJETOS'],
          description: 'LEER_TEXTO ejecuta OCR; RECONOCER_OBJETOS ejecuta YOLO.',
        },
        tipo_captura: { type: 'string', enum: ['IMAGEN', 'FOTOGRAMA'] },
        origen: { type: 'string', enum: ['CAMARA', 'GALERIA'] },
        latitud: { type: 'number', example: -17.7833 },
        longitud: { type: 'number', example: -63.1821 },
        reconocer: {
          type: 'boolean',
          example: true,
          description: 'Compatibilidad: false = solo capturar si no se envía accion_app.',
        },
        tipo_analisis: {
          type: 'string',
          enum: ['OCR'],
          description: "Solo 'OCR' = lectura continua de texto",
        },
      },
      required: ['imagen'],
    },
  })
  @ApiResponse({ status: 201, type: CapturaResponseDto })
  @ApiResponse({ status: 400, description: 'Archivo faltante o inválido.' })
  @ApiResponse({
    status: 503,
    description: 'R2 no configurado (solo si se exige almacenamiento).',
  })
  registrar(
    @CurrentUser('id_usuario') idUsuario: number,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() dto: RegistrarCapturaDto,
    @Headers('authorization') autorizacion?: string,
  ): Promise<CapturaResponseDto> {
    // ─── Validaciones del archivo (además de los limits de multer) ───
    if (!archivo) {
      throw new BadRequestException(
        'Debes enviar una imagen en el campo "imagen" del formulario.',
      );
    }
    if (!MIME_IMAGENES.includes(archivo.mimetype)) {
      throw new BadRequestException(
        `Formato no soportado (${archivo.mimetype}). Aceptados: JPEG, PNG, WEBP.`,
      );
    }

    return this.capturasService.orquestar(
        idUsuario, dto, 
        {
            buffer: archivo.buffer,
            mimeType: archivo.mimetype,
            nombre: archivo.originalname || 'captura.jpg',
        },
        autorizacion, // 🆕 "Bearer eyJ..." — se reenvía a FastAPI
    );
  }

    /**
   * MODO CONTINUO — análisis efímero de un fotograma.
   *
   * Diferencias con POST /capturas:
   *   - NO sube a R2, NO persiste la imagen (efímero por diseño)
   *   - Persiste SOLO si hay ALERTA (detección + alerta, sin imagen)
   *   - Respuesta: nivel_novedad + mensaje_voz + ritmo sugerido
   */
  @Post('analizar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('imagen', {
      limits: { fileSize: TAMANIO_MAXIMO_BYTES },
    }),
  )
  @ApiOperation({
    summary:
      'CU09/HU17 — Modo continuo: analizar fotograma (efímero) y priorizar narración',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagen: { type: 'string', format: 'binary' },
        ancho: { type: 'number', example: 640 },
        alto: { type: 'number', example: 480 },
        bajo_consumo: { type: 'string', enum: ['true', 'false'] },
        latitud: { type: 'number' },
        longitud: { type: 'number' },
        precision_gps: { type: 'number' },
      },
      required: ['imagen'],
    },
  })
  @ApiResponse({ status: 200, type: AnalisisContinuoResponseDto })
  @ApiResponse({ status: 400, description: 'Archivo faltante o inválido.' })
  analizarContinuo(
    @CurrentUser('id_usuario') idUsuario: number,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() dto: AnalisisContinuoDto,
    @Headers('authorization') autorizacion?: string,
  ): Promise<AnalisisContinuoResponseDto> {
    if (!archivo) {
      throw new BadRequestException(
        'Debes enviar el fotograma en el campo "imagen".',
      );
    }
    if (!MIME_IMAGENES.includes(archivo.mimetype)) {
      throw new BadRequestException(
        `Formato no soportado (${archivo.mimetype}). Aceptados: JPEG, PNG, WEBP.`,
      );
    }

    return this.continuoService.analizarFotograma(
      idUsuario,
      {
        buffer: archivo.buffer,
        mimeType: archivo.mimetype,
        nombre: archivo.originalname || 'fotograma.jpg',
      },
      Number(dto.ancho ?? 640),
      Number(dto.alto ?? 480),
      dto.bajo_consumo === 'true',
      autorizacion,
      dto.latitud,
      dto.longitud,
      dto.precision_gps,
      dto.tipo_analisis, // T19
    );
  }

  @Get()
  @ApiOperation({ summary: 'CU07 — Mis capturas (paginado, más recientes primero)' })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  listar(
    @CurrentUser('id_usuario') idUsuario: number,
    @Query() paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<CapturaResponseDto>> {
    return this.capturasService.listar(idUsuario, paginacion);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'CU08 — Detalle de mi captura con detecciones y resumen de voz',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: CapturaResponseDto })
  @ApiResponse({ status: 404, description: 'Captura no encontrada (o ajena).' })
  obtenerPorId(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<CapturaResponseDto> {
    return this.capturasService.obtenerPorId(id, idUsuario);
  }
}