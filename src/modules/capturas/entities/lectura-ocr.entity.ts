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
 * Entidad: lecturas_ocr — textos reconocidos mediante OCR
 * (carteles, etiquetas, precios, menús, documentos).
 * Réplica de la tabla del modelo SQL (Sprint 2).
 *
 * CHECK BD: confianza IS NULL OR confianza BETWEEN 0 AND 1
 * ══════════════════════════════════════════════════════
 */
@Entity('lecturas_ocr')
@Index('idx_ocr_captura', ['id_captura'])
export class LecturaOCR {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_lectura: number;

  @Column({
    name: 'id_captura',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_captura: number;

  /** Texto reconocido completo (puede ser multilínea) */
  @Column('text', { name: 'texto_extraido' })
  texto_extraido: string;

  /** Idioma detectado del texto (ej: 'es', 'en') */
  @Column('varchar', { length: 20, nullable: true })
  idioma: string | null;

  @Column('numeric', { precision: 5, scale: 4, nullable: true })
  confianza: number | null;

  /** Clasificación del texto leído: 'cartel', 'etiqueta', 'precio', 'menu', 'documento'... */
  @Column('varchar', { name: 'tipo_documento', length: 50, nullable: true })
  tipo_documento: string | null;

  @Column('timestamptz', {
    name: 'fecha_lectura',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_lectura: Date;

  @ManyToOne(() => CapturaEntorno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_captura' })
  captura: CapturaEntorno;
}