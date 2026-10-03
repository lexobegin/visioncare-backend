import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  BigIntPKColumn,
  BigIntTransformer,
} from '../../../common/transformers/bigint.transformer';
import { Usuario } from '../../usuarios/entities/usuario.entity';

/**
 * ══════════════════════════════════════════════════════
 * Tipos de actividad registrados en historial_actividades.
 * Estos son eventos SIN tabla propia dedicada (las capturas
 * y comandos de voz se consolidan desde sus tablas nativas).
 *
 * Se ampliará en Sprints 2-3:
 *   ALERTA_GENERADA, AYUDA_SOLICITADA, INCIDENTE_REGISTRADO,
 *   EJERCICIO_COMPLETADO, SINCRONIZACION_REALIZADA, etc.
 * ══════════════════════════════════════════════════════
 */
export const TIPOS_ACTIVIDAD = {
  USUARIO_REGISTRADO: 'USUARIO_REGISTRADO',
  SESION_INICIADA: 'SESION_INICIADA',
  PERFIL_ACTUALIZADO: 'PERFIL_ACTUALIZADO',
  CONTRASENA_CAMBIADA: 'CONTRASENA_CAMBIADA',
} as const;

export type TipoActividad =
  (typeof TIPOS_ACTIVIDAD)[keyof typeof TIPOS_ACTIVIDAD];

/**
 * ══════════════════════════════════════════════════════
 * Entidad: historial_actividades — eventos relevantes del
 * usuario. Réplica de la tabla del modelo SQL (Sprint 3,
 * en uso desde el Sprint 1).
 * ══════════════════════════════════════════════════════
 */
@Entity('historial_actividades')
@Index('idx_historial_usuario_fecha', ['id_usuario', 'fecha_actividad'])
export class HistorialActividad {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_historial: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  @Column('varchar', { name: 'tipo_actividad', length: 50 })
  tipo_actividad: string;

  /** ID del recurso relacionado (puede apuntar a cualquier tabla) */
  @Column('bigint', { name: 'referencia_id', nullable: true, transformer: BigIntTransformer })
  referencia_id: number | null;

  @Column('text', { nullable: true })
  descripcion: string | null;

  @Column('timestamptz', {
    name: 'fecha_actividad',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_actividad: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}