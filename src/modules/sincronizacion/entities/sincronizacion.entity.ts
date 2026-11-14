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

/** Direcciones (BD: ck_sync_direccion) */
export type DireccionSync = 'SUBIDA' | 'BAJADA' | 'BIDIRECCIONAL';

/** Estados (BD: ck_sync_estado) */
export type EstadoSync =
  | 'PENDIENTE'
  | 'PROCESANDO'
  | 'SINCRONIZADO'
  | 'ERROR'
  | 'CONFLICTO';

/** Resoluciones de conflicto (BD: ck_sync_resolucion) */
export type ResolucionSync = 'SERVIDOR' | 'LOCAL' | 'COMBINADA' | 'MANUAL';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: sincronizaciones — bitácora de sincronización
 * offline del móvil (CU25/CU26): cada cambio subido o cada
 * descarga de datos queda registrada por dispositivo.
 * Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: direccion SUBIDA/BAJADA/BIDIRECCIONAL |
 *           estado PENDIENTE/PROCESANDO/SINCRONIZADO/ERROR/CONFLICTO |
 *           resolucion SERVIDOR/LOCAL/COMBINADA/MANUAL (o NULL)
 * ══════════════════════════════════════════════════════
 */
@Entity('sincronizaciones')
@Index('idx_sincronizaciones_usuario_fecha', ['id_usuario', 'fecha_sincronizacion'])
export class Sincronizacion {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_sincronizacion: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  /** Identificador del dispositivo (que genera la app) */
  @Column('varchar', { name: 'dispositivo_id', length: 150 })
  dispositivo_id: string;

  @Column('varchar', { length: 20 })
  direccion: DireccionSync;

  /** Entidad sincronizada: NAVEGACION, PUNTO_NAVEGACION, HISTORIAL_ACTIVIDAD… */
  @Column('varchar', { length: 80, nullable: true })
  entidad: string | null;

  /** ID local (offline) que la app asignó al registro */
  @Column('varchar', { name: 'identificador_local', length: 150, nullable: true })
  identificador_local: string | null;

  /** ID que el servidor asignó al registro */
  @Column('bigint', {
    name: 'identificador_servidor',
    nullable: true,
    transformer: BigIntTransformer,
  })
  identificador_servidor: number | null;

  @Column('bigint', { name: 'version_local', nullable: true })
  version_local: number | null;

  @Column('bigint', { name: 'version_servidor', nullable: true })
  version_servidor: number | null;

  @Column('boolean', { name: 'conflicto_detectado', default: false })
  conflicto_detectado: boolean;

  @Column('varchar', {
    name: 'resolucion_conflicto',
    length: 30,
    nullable: true,
  })
  resolucion_conflicto: ResolucionSync | null;

  @Column('varchar', { length: 20, default: 'PENDIENTE' })
  estado: EstadoSync;

  @Column('timestamptz', {
    name: 'fecha_sincronizacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_sincronizacion: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}
