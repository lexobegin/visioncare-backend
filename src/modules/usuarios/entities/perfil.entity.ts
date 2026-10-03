import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
//import { BigIntTransformer } from '../../common/transformers/bigint.transformer';
import { BigIntTransformer, BigIntPKColumn } from '@/common/transformers/bigint.transformer';
import { Usuario } from './usuario.entity';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: perfiles — información personal 1:1 con usuarios.
 * Réplica de la tabla del modelo SQL de VisionCare AI.
 * ══════════════════════════════════════════════════════
 */
@Entity('perfiles')
export class Perfil {
  //@PrimaryGeneratedColumn({ type: 'bigint' })
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_perfil: number;

  /** FK única hacia usuarios (relación 1:1) */
  @Column({
    name: 'id_usuario',
    type: 'bigint',
    unique: true,
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  @Column('varchar', { length: 100 })
  nombres: string;

  @Column('varchar', { length: 100, nullable: true })
  apellidos: string | null;

  @Column('varchar', { length: 30, nullable: true })
  telefono: string | null;

  /** Fecha en formato 'YYYY-MM-DD' (se maneja como string para evitar problemas de zona horaria) */
  @Column('date', { name: 'fecha_nacimiento', nullable: true })
  fecha_nacimiento: string | null;

  @Column('varchar', { length: 10, default: 'es' })
  idioma: string;

  /** Referencia a la foto en Cloudflare R2 (se usa en sprints posteriores) */
  @Column('text', { name: 'foto_r2_key', nullable: true })
  foto_r2_key: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;

  /** Relación inversa hacia Usuario (comparte la columna id_usuario) */
  @OneToOne(() => Usuario, (usuario) => usuario.perfil, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}