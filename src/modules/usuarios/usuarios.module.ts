import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Perfil } from './entities/perfil.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

import { HistorialModule } from '../historial/historial.module';
import { Institucion } from '../instituciones/entities/institucion.entity';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de usuarios y perfiles.
 * Exporta UsuariosService: lo reutilizarán otros módulos
 * (capturas necesita validar usuarios, historial, etc.).
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Perfil, Institucion]),
    HistorialModule,
  ],

  controllers: [UsuariosController],

  providers: [UsuariosService],

  exports: [UsuariosService],
})
export class UsuariosModule {}
