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
 * Entidad: ubicaciones — registros GPS del usuario
 * (solicitudes de ayuda ahora; navegación en Sprint 3).
 * Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: latitud -90..90 | longitud -180..180 |
 *           precision_metros >= 0
 * ══════════════════════════════════════════════════════
 */
@Entity('ubicaciones')
@Index('idx_ubicaciones_usuario_fecha', ['id_usuario', 'fecha_registro'])
export class Ubicacion {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_ubicacion: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  @Column('numeric', { precision: 9, scale: 6 })
  latitud: number;

  @Column('numeric', { precision: 9, scale: 6 })
  longitud: number;

  /** Precisión del fix GPS en metros (menor = mejor) */
  @Column('numeric', { name: 'precision_metros', precision: 8, scale: 2, nullable: true })
  precision_metros: number | null;

  @Column('numeric', { name: 'altitud_metros', precision: 8, scale: 2, nullable: true })
  altitud_metros: number | null;

  @Column('timestamptz', {
    name: 'fecha_registro',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_registro: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}