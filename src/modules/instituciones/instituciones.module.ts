import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Institucion } from './entities/institucion.entity';
import { InstitucionesController } from './instituciones.controller';
import { InstitucionesService } from './instituciones.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de instituciones.
 * Registra Usuario (solo lectura) para calcular total_usuarios.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [TypeOrmModule.forFeature([Institucion, Usuario])],

  controllers: [InstitucionesController],

  providers: [InstitucionesService],

  exports: [InstitucionesService],
})
export class InstitucionesModule {}