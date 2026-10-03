import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ContactoConfianza } from './entities/contacto-confianza.entity';
import { ContactosController } from './contactos.controller';
import { ContactosService } from './contactos.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de contactos de confianza (CU05 / base CU36).
 * Exporta ContactosService: el módulo de ayuda (Sprint 3)
 * lo usará para notificar contactos en emergencias.
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [TypeOrmModule.forFeature([ContactoConfianza, Usuario])],

  controllers: [ContactosController],

  providers: [ContactosService],

  exports: [ContactosService],
})
export class ContactosModule {}