import {
  Column,
  CreateDateColumn,
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
import { DeteccionIA } from './deteccion-ia.entity';

/** Tipos según BD: CHECK (tipo_captura IN ('IMAGEN','VIDEO','FOTOGRAMA')) */
export type TipoCaptura = 'IMAGEN' | 'VIDEO' | 'FOTOGRAMA';

/** Orígenes según BD: CHECK (origen IN ('CAMARA','GALERIA')) */
export type OrigenCaptura = 'CAMARA' | 'GALERIA';

/** Estados según BD: CHECK (estado IN ('PENDIENTE','PROCESANDO','PROCESADA','ERROR')) */
export type EstadoCaptura = 'PENDIENTE' | 'PROCESANDO' | 'PROCESADA' | 'ERROR';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: capturas_entorno — capturas de cámara para
 * análisis visual. Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: latitud BETWEEN -90 AND 90,
 *           longitud BETWEEN -180 AND 180
 * ══════════════════════════════════════════════════════
 */
@Entity('capturas_entorno')
@Index('idx_capturas_usuario_fecha', ['id_usuario', 'fecha_captura'])
@Index('idx_capturas_estado', ['estado'])
export class CapturaEntorno {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_captura: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  /** Referencia al archivo en Cloudflare R2 (NULL si R2 no está configurado) */
  @Column('text', { name: 'r2_key', nullable: true })
  r2_key: string | null;

  @Column('varchar', { length: 30, default: 'IMAGEN' })
  tipo_captura: TipoCaptura;

  @Column('varchar', { length: 20, default: 'CAMARA' })
  origen: OrigenCaptura;

  @Column('numeric', { precision: 9, scale: 6, nullable: true })
  latitud: number | null;

  @Column('numeric', { precision: 9, scale: 6, nullable: true })
  longitud: number | null;

  @Column('timestamptz', {
    name: 'fecha_captura',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_captura: Date;

  /** Indica si ya fue analizada por IA */
  @Column('boolean', { default: false })
  procesada: boolean;

  @Column('varchar', { length: 20, default: 'PENDIENTE' })
  estado: EstadoCaptura;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  /** Detecciones producidas por IA sobre esta captura */
  @OneToMany(() => DeteccionIA, (deteccion) => deteccion.captura)
  detecciones: DeteccionIA[];
}