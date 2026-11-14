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
import { SesionVc } from './sesion.entity';
import { EjercicioVc } from './ejercicio.entity';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: resultados_visioncoach — un ejercicio resuelto
 * dentro de una sesión (CU29). La puntuación la calcula el
 * servidor (puntos_base del ejercicio si `correcto`).
 * Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: puntuacion >= 0 | tiempo_segundos >= 0 (o NULL)
 * ══════════════════════════════════════════════════════
 */
@Entity('resultados_visioncoach')
@Index('idx_resultados_sesion', ['id_sesion'])
@Index('idx_resultados_ejercicio', ['id_ejercicio'])
export class ResultadoVc {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_resultado: number;

  @Column({
    name: 'id_sesion',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_sesion: number;

  @Column({
    name: 'id_ejercicio',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_ejercicio: number;

  /** Respuesta dada por el usuario (texto/voz) */
  @Column('text', { nullable: true })
  respuesta: string | null;

  @Column('boolean', { nullable: true })
  correcto: boolean | null;

  @Column('integer', { default: 0 })
  puntuacion: number;

  @Column('integer', { name: 'tiempo_segundos', nullable: true })
  tiempo_segundos: number | null;

  @Column('text', { nullable: true })
  observaciones: string | null;

  @Column('timestamptz', {
    name: 'fecha_resultado',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_resultado: Date;

  // ─── Relaciones ───

  @ManyToOne(() => SesionVc, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_sesion' })
  sesion: SesionVc;

  @ManyToOne(() => EjercicioVc, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_ejercicio' })
  ejercicio: EjercicioVc;
}
