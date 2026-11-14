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
import { EjercicioVc } from './ejercicio.entity';

/** Estados (BD: ck_desafio_estado) */
export type EstadoDesafioVc = 'ASIGNADO' | 'EN_CURSO' | 'COMPLETADO' | 'OMITIDO';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: desafios_adaptativos — ejercicio con dificultad
 * ajustada que el backend asigna según el rendimiento de la
 * sesión (CU31): ≥80% aciertos sube un nivel, <40% baja.
 * Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: dificultad_asignada 1..5 |
 *           estado ASIGNADO/EN_CURSO/COMPLETADO/OMITIDO
 * ══════════════════════════════════════════════════════
 */
@Entity('desafios_adaptativos')
@Index('idx_desafios_usuario_estado', ['id_usuario', 'estado'])
export class DesafioVc {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_desafio: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  @Column({
    name: 'id_ejercicio',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_ejercicio: number;

  @Column('smallint', { name: 'dificultad_asignada' })
  dificultad_asignada: number;

  /** Por qué se asignó (ej: "Rendimiento alto en la sesión #12") */
  @Column('text', { name: 'motivo_adaptacion', nullable: true })
  motivo_adaptacion: string | null;

  @Column('varchar', { length: 20, default: 'ASIGNADO' })
  estado: EstadoDesafioVc;

  @Column('timestamptz', {
    name: 'fecha_asignacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_asignacion: Date;

  @Column('timestamptz', { name: 'fecha_completado', nullable: true })
  fecha_completado: Date | null;

  // ─── Relaciones ───

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => EjercicioVc, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_ejercicio' })
  ejercicio: EjercicioVc;
}
