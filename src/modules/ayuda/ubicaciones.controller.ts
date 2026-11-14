import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompartirUbicacionDto } from './dto/compartir-ubicacion.dto';
import { UbicacionesService } from './ubicaciones.service';
import { Usuario } from '../usuarios/entities/usuario.entity';

/** Query ?ventana_min= del listado en vivo */
class VentanaQueryDto {
  @ApiPropertyOptional({ example: 15, description: 'Ventana de "en vivo" en minutos (1–120)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  ventana_min?: number;
}

/** Query ?limit= de la ruta */
class LimiteQueryDto {
  @ApiPropertyOptional({ example: 30, description: 'Puntos a devolver (1–100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * ══════════════════════════════════════════════════════
 * CU21 — Ubicación compartida (Sprint 3).
 *
 *   POST /ayuda/ubicacion                → el móvil guarda un ping GPS
 *   GET  /ayuda/ubicaciones-activas      → ADMIN/INSTITUCION: mapa en vivo
 *   GET  /ayuda/ubicaciones/usuario/:id  → dueño/gestor: ruta + contactos
 *
 * El ping llega SOLO cuando el usuario activó el asistente
 * continuo o el toggle "Compartir mi ubicación" (consentimiento).
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Ayuda / Ubicaciones (CU21)')
@ApiBearerAuth()
@Controller('ayuda')
export class UbicacionesController {
  constructor(private readonly ubicacionesService: UbicacionesService) {}

  @Post('ubicacion')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'CU21 — Registrar un ping GPS del usuario autenticado',
    description:
      'El móvil lo envía automáticamente mientras el asistente continuo ' +
      'está activo, o al activar "Compartir mi ubicación".',
  })
  @ApiResponse({ status: 201, description: 'Ping registrado' })
  async compartir(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: CompartirUbicacionDto,
  ) {
    const fila = await this.ubicacionesService.registrar(idUsuario, dto);
    return {
      id_ubicacion: fila.id_ubicacion,
      latitud: fila.latitud,
      longitud: fila.longitud,
      precision_metros: fila.precision_metros,
      fecha_registro: fila.fecha_registro,
    };
  }

  @Get('ubicaciones-activas')
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({
    summary: 'CU21 — Usuarios "en vivo" (ping reciente) para el mapa web',
    description:
      'Última ubicación de cada usuario con ping dentro de la ventana ' +
      '(defecto 15 min), teléfono del usuario y contactos de confianza ' +
      'autorizados_ubicacion (para llamar). ADMIN: global; INSTITUCION: su institución.',
  })
  async activos(
    @CurrentUser() usuario: Usuario,
    @Query() query: VentanaQueryDto,
  ) {
    const usuarios = await this.ubicacionesService.activos(
      usuario,
      query.ventana_min,
    );
    return {
      ok: true,
      ventana_min: query.ventana_min ?? 15,
      total: usuarios.length,
      datos: usuarios,
    };
  }

  @Get('ubicaciones/usuario/:id')
  @ApiOperation({
    summary: 'CU21 — Ruta GPS reciente de un usuario + contactos autorizados',
  })
  @ApiParam({ name: 'id', example: 1 })
  async ruta(
    @CurrentUser() usuario: Usuario,
    @Param('id', ParseIntPipe) idUsuarioObjetivo: number,
    @Query() query: LimiteQueryDto,
  ) {
    return this.ubicacionesService.ruta(idUsuarioObjetivo, usuario, query.limit);
  }
}
