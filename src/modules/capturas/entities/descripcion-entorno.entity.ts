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
import { CapturaEntorno } from './captura-entorno.entity';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: descripciones_entorno — descripciones generadas
 * por IA sobre los elementos relevantes de una escena
 * (Sprint 2: composición espacial a partir de bboxes de
 * YOLO; ampliación con modelos de lenguaje en Sprints 3+).
 * Réplica de la tabla del modelo SQL (Sprint 2).
 * ══════════════════════════════════════════════════════
 */
@Entity('descripciones_entorno')
@Index('idx_descripciones_captura', ['id_captura'])
export class DescripcionEntorno {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_descripcion: number;

  @Column({
    name: 'id_captura',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_captura: number;

  /** Descripción completa de la escena */
  @Column('text')
  descripcion: string;

  /** Versión corta lista para TTS (la usará el modo continuo) */
  @Column('text', { nullable: true })
  resumen: string | null;

  @Column('numeric', { precision: 5, scale: 4, nullable: true })
  confianza: number | null;

  @Column('timestamptz', {
    name: 'fecha_generacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_generacion: Date;

  @ManyToOne(() => CapturaEntorno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_captura' })
  captura: CapturaEntorno;
}