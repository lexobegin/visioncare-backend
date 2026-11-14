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
import { Incidente } from './incidente.entity';

/** Tipos de archivo aceptados (BD: ck_evidencia_tipo) */
export type TipoArchivoEvidencia =
  | 'IMAGEN'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENTO';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: evidencias_incidente — archivos multimedia de un
 * incidente, almacenados en Cloudflare R2.
 * Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: tipo_archivo IMAGEN/VIDEO/AUDIO/DOCUMENTO |
 *           tamano_bytes >= 0
 * ══════════════════════════════════════════════════════
 */
@Entity('evidencias_incidente')
@Index('idx_evidencias_incidente', ['id_incidente'])
export class EvidenciaIncidente {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_evidencia: number;

  @Column({
    name: 'id_incidente',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_incidente: number;

  @Column('varchar', { name: 'tipo_archivo', length: 30 })
  tipo_archivo: TipoArchivoEvidencia;

  /** Nombre original del archivo (informativo) */
  @Column('varchar', { name: 'nombre_archivo', length: 255, nullable: true })
  nombre_archivo: string | null;

  /** Key relativa dentro del bucket R2 (nunca URL absoluta) */
  @Column('text', { name: 'r2_key' })
  r2_key: string;

  @Column('varchar', { name: 'mime_type', length: 100, nullable: true })
  mime_type: string | null;

  @Column('bigint', {
    name: 'tamano_bytes',
    nullable: true,
    transformer: BigIntTransformer,
  })
  tamano_bytes: number | null;

  @Column('timestamptz', {
    name: 'fecha_registro',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_registro: Date;

  @ManyToOne(() => Incidente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_incidente' })
  incidente: Incidente;
}
