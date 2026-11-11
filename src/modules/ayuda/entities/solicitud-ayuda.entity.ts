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
import { Ubicacion } from './ubicacion.entity';
import { DestinatarioAyuda } from './destinatario-ayuda.entity';

/** Tipos (BD: ck_solicitud_tipo) */
export type TipoSolicitud = 'AYUDA' | 'EMERGENCIA' | 'ASISTENCIA';

/** Estados (BD: ck_solicitud_estado) */
export type EstadoSolicitud =
  | 'PENDIENTE'   // creada, procesando destinatarios
  | 'ENVIADA'     // notificada a los contactos
  | 'ATENDIDA'    // un contacto/admin la atendió
  | 'CANCELADA';  // el usuario la canceló

/**
 * ══════════════════════════════════════════════════════
 * Entidad: solicitudes_ayuda — pedido de ayuda generado
 * desde el móvil (CU20: comando de voz o botón).
 * Réplica de la tabla del modelo SQL.
 * ══════════════════════════════════════════════════════
 */
@Entity('solicitudes_ayuda')
@Index('idx_solicitudes_usuario_fecha', ['id_usuario', 'fecha_solicitud'])
@Index('idx_solicitudes_estado', ['estado'])
export class SolicitudAyuda {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_solicitud: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  /** Ubicación al momento de la solicitud (SET NULL si se borra) */
  @Column({
    name: 'id_ubicacion',
    type: 'bigint',
    nullable: true,
    transformer: BigIntTransformer,
  })
  id_ubicacion: number | null;

  @Column('varchar', { default: 'AYUDA' })
  tipo: TipoSolicitud;

  /** Mensaje opcional del usuario (voz dictada o texto) */
  @Column('text', { nullable: true })
  mensaje: string | null;

  @Column('varchar', { length: 20, default: 'PENDIENTE' })
  estado: EstadoSolicitud;

  @Column('timestamptz', {
    name: 'fecha_solicitud',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_solicitud: Date;

  @Column('timestamptz', { name: 'fecha_resolucion', nullable: true })
  fecha_resolucion: Date | null;

  // ─── Relaciones ───

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Ubicacion, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_ubicacion' })
  ubicacion: Ubicacion | null;

  /** Contactos notificados en esta solicitud */
  @OneToMany(
    () => DestinatarioAyuda,
    (destinatario) => destinatario.solicitud,
  )
  destinatarios: DestinatarioAyuda[];
}