import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntTransformer, BigIntPKColumn } from '@/common/transformers/bigint.transformer';
import { Perfil } from './perfil.entity';

/** Roles según la BD: CHECK (rol IN ('USUARIO','ADMIN','INSTITUCION')) */
export type RolUsuario = 'USUARIO' | 'ADMIN' | 'INSTITUCION';

/** Estados según la BD: CHECK (estado IN ('ACTIVO','INACTIVO','BLOQUEADO')) */
export type EstadoUsuario = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: usuarios (tabla central de cuentas de acceso)
 * Réplica de la tabla del modelo SQL de VisionCare AI.
 * ══════════════════════════════════════════════════════
 */
@Entity('usuarios')
export class Usuario {
  //@PrimaryGeneratedColumn({ type: 'bigint' })
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_usuario?: number;

  /** Institución a la que pertenece (NULL = usuario libre) */
  @Column({
    name: 'id_institucion',
    type: 'bigint',
    nullable: true,
    transformer: BigIntTransformer,
  })
  id_institucion?: number | null;

  /** Correo único — usado para login */
  @Column('varchar', { length: 150, unique: true })
  correo: string;

  /**
   * Hash bcrypt. ⚠️ select:false → este campo NO se devuelve en
   * find()/findOne() normales (nunca se filtra por accidente).
   * Para login se recupera explícitamente con query builder.
   * Nullable para usuarios que inician con Google / Apple / Facebook.
   */
  @Column('text', { name: 'contrasena_hash', select: false, nullable: true })
  contrasena_hash?: string | null;

  /** Proveedor de autenticación: LOCAL, GOOGLE, APPLE, FACEBOOK */
  @Column('varchar', { length: 50, default: 'LOCAL', name: 'proveedor_auth' })
  proveedor_auth?: string;

  /** Identificador único del usuario provisto por Google/Apple/Facebook */
  @Column('varchar', { length: 255, nullable: true, name: 'id_proveedor' })
  id_proveedor?: string | null;

  @Column('varchar', { length: 20, default: 'USUARIO' })
  rol: RolUsuario;

  @Column('varchar', { length: 20, default: 'ACTIVO' })
  estado: EstadoUsuario;

  @Column('timestamptz', { name: 'ultimo_acceso', nullable: true })
  ultimo_acceso: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;

  /** Perfil 1:1 (se carga bajo demanda, no eager) */
  @OneToOne(() => Perfil, (perfil) => perfil.usuario)
  perfil: Perfil;
}
