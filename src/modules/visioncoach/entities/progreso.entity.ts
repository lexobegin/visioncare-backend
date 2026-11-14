import {
  Column,
  Entity,
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
 * Entidad: progreso_visioncoach — acumulados del usuario
 * (UNIQUE id_usuario: 1 fila por usuario). El service la
 * crea la primera vez que entrena (getOrCreate).
 * Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: nivel >= 1 | puntos/rachas/ejercicios >= 0
 * Nivel alcanzado: floor(puntos_totales / 100) + 1
 * ══════════════════════════════════════════════════════
 */
@Entity('progreso_visioncoach')
export class ProgresoVc {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_progreso: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    unique: true,
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  @Column('integer', { default: 1 })
  nivel: number;

  @Column('integer', { name: 'puntos_totales', default: 0 })
  puntos_totales: number;

  @Column('integer', { name: 'racha_actual', default: 0 })
  racha_actual: number;

  @Column('integer', { name: 'mejor_racha', default: 0 })
  mejor_racha: number;

  @Column('integer', { name: 'ejercicios_completados', default: 0 })
  ejercicios_completados: number;

  @Column('timestamptz', {
    name: 'actualizado_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  actualizado_at: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}
