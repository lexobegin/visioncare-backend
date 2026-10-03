import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators';

/**
 * ══════════════════════════════════════════════════════
 * Endpoint de salud — verifica que la API esté en línea.
 * Útil para pruebas locales, balanceadores y monitoreo.
 *
 * GET /api/v1/health
 * (Cuando exista el guard JWT global, se marcará con @Public())
 * ══════════════════════════════════════════════════════
 */
@ApiTags('Salud')
@Controller('health')
export class HealthController {
  @Public() // 🆕 — permanece accesible sin token
  @Get()
  @ApiOperation({ summary: 'Verifica que la API esté en línea' })
  check() {
    return {
      status: 'ok',
      app: 'VisionCare AI API',
      sprint: 1,
      timestamp: new Date().toISOString(),
      uptimeSegundos: Math.floor(process.uptime()),
    };
  }
}