import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
//import { BigIntTransformer } from '@/common/transformers/bigint.transformer';
import { BigIntPKColumn } from '@/common/transformers/bigint.transformer';

/** Estados según la BD: CHECK (estado IN ('ACTIVA','INACTIVA')) */
export type EstadoInstitucion = 'ACTIVA' | 'INACTIVA';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: instituciones — organizaciones que administran o
 * acompañan usuarios de VisionCare AI.
 * Réplica de la tabla del modelo SQL ( Sprint 1).
 * ══════════════════════════════════════════════════════
 */
@Entity('instituciones')
export class Institucion {
  //@PrimaryGeneratedColumn({ type: 'bigint', transformer: BigIntTransformer })
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_institucion: number;

  /** Nombre único de la institución */
  @Column('varchar', { length: 150, unique: true })
  nombre: string;

  @Column('text', { nullable: true })
  descripcion: string | null;

  @Column('varchar', { length: 30, nullable: true })
  telefono: string | null;

  @Column('varchar', { length: 150, nullable: true })
  correo: string | null;

  @Column('text', { nullable: true })
  direccion: string | null;

  @Column('varchar', { length: 20, default: 'ACTIVA' })
  estado: EstadoInstitucion;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;
}