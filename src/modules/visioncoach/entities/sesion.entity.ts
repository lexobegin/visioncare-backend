import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  BigIntPKColumn,
  BigIntTransformer,
} from '../../../common/transformers/bigint.transformer';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { ResultadoVc } from './resultado.entity';

/** Estados (BD: ck_sesion_estado) */
export type EstadoSesionVc = 'INICIADA' | 'COMPLETADA' | 'ABANDONADA';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: sesiones_visioncoach — sesión de entrenamiento del
 * usuario (CU28): agrupa resultados y suma puntos.
 * Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: puntos_obtenidos >= 0 |
 *           estado INICIADA/COMPLETADA/ABANDONADA
 * ══════════════════════════════════════════════════════
 */
@Entity('sesiones_visioncoach')
@Index('idx_sesiones_usuario_fecha', ['id_usuario', 'fecha_inicio'])
export class SesionVc {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_sesion: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  @Column('timestamptz', {
    name: 'fecha_inicio',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_inicio: Date;

  @Column('timestamptz', { name: 'fecha_fin', nullable: true })
  fecha_fin: Date | null;

  @Column('integer', { name: 'puntos_obtenidos', default: 0 })
  puntos_obtenidos: number;

  @Column('varchar', { length: 20, default: 'INICIADA' })
  estado: EstadoSesionVc;

  // ─── Relaciones ───

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @OneToMany(() => ResultadoVc, (resultado) => resultado.sesion)
  resultados: ResultadoVc[];
}
