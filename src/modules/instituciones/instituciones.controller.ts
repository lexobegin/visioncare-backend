import {
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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { PaginationDto, RespuestaPaginada } from '../../common/dto/pagination.dto';
import { ParseIdPipe } from '../../common/pipes';
import {
  ActualizarInstitucionDto,
  CrearInstitucionDto,
  InstitucionResponseDto,
} from './dto';
import { InstitucionesService } from './instituciones.service';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de instituciones:
 *
 *   POST   /instituciones            → crear (ADMIN)
 *   GET    /instituciones            → listado paginado (ADMIN, INSTITUCION)
 *   GET    /instituciones/:id        → detalle (ADMIN, INSTITUCION)
 *   PATCH  /instituciones/:id        → actualizar (ADMIN)
 *   DELETE /instituciones/:id        → desactivar (ADMIN)
 *   PATCH  /instituciones/:id/activar → reactivar (ADMIN)
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Instituciones')
@ApiBearerAuth('JWT-auth')
@Controller('instituciones')
export class InstitucionesController {
  constructor(private readonly institucionesService: InstitucionesService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear institución (solo ADMIN)' })
  @ApiResponse({ status: 201, type: InstitucionResponseDto })
  @ApiResponse({ status: 409, description: 'Nombre duplicado.' })
  crear(@Body() dto: CrearInstitucionDto): Promise<InstitucionResponseDto> {
    return this.institucionesService.crear(dto);
  }

  @Get()
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({ summary: 'Listar instituciones (paginado, búsqueda libre)' })
  @ApiResponse({ status: 200, description: 'Listado paginado.' })
  listar(
    @Query() paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<InstitucionResponseDto>> {
    return this.institucionesService.listar(paginacion);
  }

  @Get(':id')
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({ summary: 'Ver detalle de una institución' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: InstitucionResponseDto })
  @ApiResponse({ status: 404, description: 'Institución no encontrada.' })
  obtenerPorId(
    @Param('id', ParseIdPipe) id: number,
  ): Promise<InstitucionResponseDto> {
    return this.institucionesService.obtenerPorId(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar datos de la institución (solo ADMIN)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: InstitucionResponseDto })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN.' })
  actualizar(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: ActualizarInstitucionDto,
  ): Promise<InstitucionResponseDto> {
    return this.institucionesService.actualizar(id, dto);
  }

  @Patch(':id/activar')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reactivar una institución (solo ADMIN)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Institución activada.' })
  activar(
    @Param('id', ParseIdPipe) id: number,
  ): Promise<{ mensaje: string }> {
    return this.institucionesService.activar(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar institución (borrado lógico, solo ADMIN)' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Institución desactivada.' })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN.' })
  desactivar(
    @Param('id', ParseIdPipe) id: number,
  ): Promise<{ mensaje: string }> {
    return this.institucionesService.desactivar(id);
  }
}