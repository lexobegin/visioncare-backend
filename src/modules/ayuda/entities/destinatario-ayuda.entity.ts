import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import {
  BigIntPKColumn,
  BigIntTransformer,
} from '../../../common/transformers/bigint.transformer';
import { SolicitudAyuda } from './solicitud-ayuda.entity';
import { ContactoConfianza } from '../../contactos/entities/contacto-confianza.entity';

/** Canales de envío (BD: ck_destinatario_canal) */
export type CanalEnvio = 'SMS' | 'LLAMADA' | 'CORREO' | 'NOTIFICACION';

/** Estados de envío (BD: ck_destinatario_estado) */
export type EstadoEnvio = 'PENDIENTE' | 'ENVIADO' | 'RECIBIDO' | 'ERROR';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: destinatarios_ayuda — contactos de confianza
 * notificados durante una solicitud. Trazabilidad por
 * contacto: quién fue notificado, por qué canal y cuándo.
 * Réplica de la tabla del modelo SQL.
 *
 * UNIQUE (id_solicitud, id_contacto): un contacto no se
 * repite en la misma solicitud.
 * ══════════════════════════════════════════════════════
 */
@Entity('destinatarios_ayuda')
@Index('idx_destinatarios_solicitud', ['id_solicitud'])
@Unique('uq_destinatario', ['id_solicitud', 'id_contacto'])
export class DestinatarioAyuda {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_destinatario: number;

  @Column({
    name: 'id_solicitud',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_solicitud: number;

  /** RESTRICT en SQL: no se borra un contacto con envíos asociados */
  @Column({
    name: 'id_contacto',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_contacto: number;

  @Column('varchar', { length: 30 })
  canal: CanalEnvio;

  @Column('varchar', { name: 'estado_envio', length: 20, default: 'PENDIENTE' })
  estado_envio: EstadoEnvio;

  @Column('timestamptz', { name: 'fecha_envio', nullable: true })
  fecha_envio: Date | null;

  // ─── Relaciones ───

  @ManyToOne(() => SolicitudAyuda, (solicitud) => solicitud.destinatarios, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud: SolicitudAyuda;

  @ManyToOne(() => ContactoConfianza, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_contacto' })
  contacto: ContactoConfianza;
}