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
import { CategoriaVc } from './categoria.entity';

/** Estados (BD: ck_ejercicio_estado) */
export type EstadoEjercicioVc = 'ACTIVO' | 'INACTIVO';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: ejercicios_visioncoach — ejercicios del catálogo.
 * Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: dificultad 1..5 | puntos_base >= 0 |
 *           duracion_estimada_segundos > 0 (o NULL)
 * ══════════════════════════════════════════════════════
 */
@Entity('ejercicios_visioncoach')
@Index('idx_ejercicios_categoria', ['id_categoria'])
export class EjercicioVc {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_ejercicio: number;

  @Column({
    name: 'id_categoria',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_categoria: number;

  @Column('varchar', { length: 150 })
  nombre: string;

  @Column('text')
  descripcion: string;

  @Column('smallint', { default: 1 })
  dificultad: number;

  /** Puntos que otorga resolverlo correctamente (server-side) */
  @Column('integer', { name: 'puntos_base', default: 10 })
  puntos_base: number;

  @Column('integer', { name: 'duracion_estimada_segundos', nullable: true })
  duracion_estimada_segundos: number | null;

  @Column('varchar', { length: 20, default: 'ACTIVO' })
  estado: EstadoEjercicioVc;

  @Column('timestamptz', {
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @Column('timestamptz', {
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  @ManyToOne(() => CategoriaVc, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_categoria' })
  categoria: CategoriaVc;
}