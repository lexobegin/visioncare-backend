import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators';
import { ParseIdPipe } from '../../common/pipes';
import {
  ActualizarPreferenciasDto,
  PreferenciasResponseDto,
} from './dto';
import { AccesibilidadService } from './accesibilidad.service';

/**
 * ══════════════════════════════════════════════════════
 * Endpoints de accesibilidad (todos requieren token JWT):
 *
 *   GET   /accesibilidad/me           → mis preferencias (auto-crea defaults)
 *   PATCH /accesibilidad/me           → actualizar mis preferencias (CU03)
 *   GET   /accesibilidad/usuario/:id  → consultar preferencias de un usuario
 *                                       (CU35 — solo ADMIN/INSTITUCION)
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Accesibilidad')
@ApiBearerAuth('JWT-auth')
@Controller('accesibilidad')
export class AccesibilidadController {
  constructor(private readonly accesibilidadService: AccesibilidadService) {}

  @Get('me')
  @ApiOperation({
    summary: 'CU03 — Obtener mis preferencias (crea defaults si no existen)',
  })
  @ApiResponse({ status: 200, type: PreferenciasResponseDto })
  obtenerMisPreferencias(
    @CurrentUser('id_usuario') idUsuario: number,
  ): Promise<PreferenciasResponseDto> {
    return this.accesibilidadService.obtener(idUsuario);
  }

  @Patch('me')
  @ApiOperation({ summary: 'CU03 — Actualizar mis preferencias de accesibilidad' })
  @ApiResponse({ status: 200, type: PreferenciasResponseDto })
  @ApiResponse({ status: 400, description: 'Sin campos o valores fuera de rango.' })
  actualizarMisPreferencias(
    @CurrentUser('id_usuario') idUsuario: number,
    @Body() dto: ActualizarPreferenciasDto,
  ): Promise<PreferenciasResponseDto> {
    return this.accesibilidadService.actualizar(idUsuario, dto);
  }

  @Get('usuario/:id')
  @Roles('ADMIN', 'INSTITUCION')
  @ApiOperation({
    summary: 'CU35 — Consultar preferencias de un usuario (ADMIN/INSTITUCION)',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: PreferenciasResponseDto })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN o INSTITUCION.' })
  obtenerPorUsuario(
    @Param('id', ParseIdPipe) id: number,
  ): Promise<PreferenciasResponseDto> {
    return this.accesibilidadService.obtener(id);
  }
}