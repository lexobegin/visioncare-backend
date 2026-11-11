import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Alerta } from '../alertas/entities/alerta.entity';
import { AlertasModule } from '../alertas/alertas.module';
import { PriorizacionService } from '../alertas/priorizacion.service';
import { AnalisisContinuoService } from './analisis-continuo.service';

import { BilleteReconocido } from './entities/billete-reconocido.entity';
import { CapturaEntorno } from './entities/captura-entorno.entity';
import { ColorReconocido } from './entities/color-reconocido.entity';
import { DescripcionEntorno } from './entities/descripcion-entorno.entity';
import { DeteccionIA } from './entities/deteccion-ia.entity';
import { LecturaOCR } from './entities/lectura-ocr.entity';
import { ProductoReconocido } from './entities/producto-reconocido.entity';
import { SenalLugar } from './entities/senal-lugar.entity';
import { CapturasController } from './capturas.controller';
import { CapturasService } from './capturas.service';
import { VisionIaClient } from './vision-ia.client';

/**
 * Módulo de capturas — el MODO CONTINUO (AnalisisContinuoService)
 * consume PriorizacionService + Repository<Alerta> exportados
 * por AlertasModule (eliminado el provider duplicado local).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CapturaEntorno,
      DeteccionIA,
      LecturaOCR,
      SenalLugar,
      ProductoReconocido,
      ColorReconocido,
      BilleteReconocido,
      DescripcionEntorno,
      // Alerta, // Alerta eliminada — viene de AlertasModule
    ]),

    AlertasModule, // provee PriorizacionService + Repository<Alerta>
  ],

  controllers: [CapturasController],

  providers: [
    CapturasService, 
    VisionIaClient, 
    AnalisisContinuoService, 
    // PriorizacionService, // PriorizacionService eliminado — lo exporta AlertasModule
  ],

  exports: [CapturasService, AnalisisContinuoService],
})
export class CapturasModule {}