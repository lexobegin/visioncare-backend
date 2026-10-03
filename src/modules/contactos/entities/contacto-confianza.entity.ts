import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  BigIntPKColumn,
  BigIntTransformer,
} from '../../../common/transformers/bigint.transformer';
import { Usuario } from '../../usuarios/entities/usuario.entity';

/** Estados según la BD: CHECK (estado IN ('ACTIVO','INACTIVO')) */
export type EstadoContacto = 'ACTIVO' | 'INACTIVO';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: contactos_confianza — personas autorizadas para
 * recibir solicitudes de ayuda, emergencias y ubicación.
 * Réplica de la tabla del modelo SQL (Sprint 1).
 *
 * Restricción BD (CHECK ck_contacto_medio):
 *   telefono IS NOT NULL OR correo IS NOT NULL
 *   (al menos un medio de contacto — validamos también en DTO)
 * ══════════════════════════════════════════════════════
 */
@Entity('contactos_confianza')
export class ContactoConfianza {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_contacto: number;

  /** Propietario del contacto (FK, ON DELETE CASCADE) */
  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  @Column('varchar', { length: 120 })
  nombre: string;

  /** Ej: 'Madre', 'Hermano', 'Vecino', 'Cuidador' */
  @Column('varchar', { length: 80, nullable: true })
  parentesco: string | null;

  @Column('varchar', { length: 30, nullable: true })
  telefono: string | null;

  @Column('varchar', { length: 150, nullable: true })
  correo: string | null;

  /** Orden de notificación: 1 = primero (CHECK prioridad > 0) */
  @Column('smallint', { default: 1 })
  prioridad: number;

  /** Puede recibir la ubicación del usuario */
  @Column('boolean', { name: 'autorizado_ubicacion', default: false })
  autorizado_ubicacion: boolean;

  /** Puede recibir solicitudes de emergencia */
  @Column('boolean', { name: 'autorizado_emergencias', default: true })
  autorizado_emergencias: boolean;

  @Column('varchar', { length: 20, default: 'ACTIVO' })
  estado: EstadoContacto;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;

  /** Un usuario tiene muchos contactos (N:1) */
  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}