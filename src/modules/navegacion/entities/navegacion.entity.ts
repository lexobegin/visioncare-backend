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
import { PuntoNavegacion } from './punto-navegacion.entity';

/** Modos (BD: ck_navegacion_modo) */
export type ModoNavegacion = 'ASISTIDA' | 'VOZ' | 'MAPA';

/** Estados (BD: ck_navegacion_estado) */
export type EstadoNavegacion =
  | 'INICIADA'
  | 'EN_CURSO'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'ERROR';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: navegaciones — sesión de navegación asistida del
 * usuario (CU24): origen, destino y traza de puntos GPS.
 * Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: modo ASISTIDA/VOZ/MAPA |
 *           estado INICIADA/EN_CURSO/COMPLETADA/CANCELADA/ERROR
 * ══════════════════════════════════════════════════════
 */
@Entity('navegaciones')
@Index('idx_navegaciones_usuario_fecha', ['id_usuario', 'fecha_inicio'])
export class Navegacion {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_navegacion: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  @Column('numeric', { name: 'origen_latitud', precision: 9, scale: 6, nullable: true })
  origen_latitud: number | null;

  @Column('numeric', { name: 'origen_longitud', precision: 9, scale: 6, nullable: true })
  origen_longitud: number | null;

  @Column('numeric', { name: 'destino_latitud', precision: 9, scale: 6, nullable: true })
  destino_latitud: number | null;

  @Column('numeric', { name: 'destino_longitud', precision: 9, scale: 6, nullable: true })
  destino_longitud: number | null;

  @Column('varchar', { name: 'destino_descripcion', length: 255, nullable: true })
  destino_descripcion: string | null;

  @Column('varchar', { length: 30, default: 'ASISTIDA' })
  modo: ModoNavegacion;

  @Column('varchar', { length: 20, default: 'INICIADA' })
  estado: EstadoNavegacion;

  @Column('timestamptz', {
    name: 'fecha_inicio',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_inicio: Date;

  @Column('timestamptz', { name: 'fecha_fin', nullable: true })
  fecha_fin: Date | null;

  // ─── Relaciones ───

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  /** Traza GPS en orden de recorrido */
  @OneToMany(
    () => PuntoNavegacion,
    (punto) => punto.navegacion,
  )
  puntos: PuntoNavegacion[];
}
