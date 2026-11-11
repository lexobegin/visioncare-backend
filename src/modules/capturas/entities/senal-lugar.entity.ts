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
 * Entidad: senales_lugares — señales, salidas, baños,
 * escaleras, cruces y elementos de orientación reconocidos.
 * Réplica de la tabla del modelo SQL (Sprint 2).
 *
 * Fuentes de detección (Sprint 2, motor IA):
 *   - YOLO COCO: 'stop sign', 'traffic light'
 *   - OCR de palabras clave: SALIDA, BAÑO, WC, PELIGRO...
 * ══════════════════════════════════════════════════════
 */
@Entity('senales_lugares')
@Index('idx_senales_captura', ['id_captura'])
export class SenalLugar {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_senal: number;

  @Column({
    name: 'id_captura',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_captura: number;

  /** Tipo de elemento: 'senal_stop', 'semáforo', 'salida', 'baño', 'escaleras', 'peligro'... */
  @Column('varchar', { name: 'tipo_senal', length: 100 })
  tipo_senal: string;

  /** Texto/nombre específico reconocido (ej: 'SALIDA 3', 'BAÑOS') */
  @Column('varchar', { name: 'nombre_reconocido', length: 150, nullable: true })
  nombre_reconocido: string | null;

  @Column('text', { nullable: true })
  descripcion: string | null;

  @Column('numeric', { precision: 5, scale: 4, nullable: true })
  confianza: number | null;

  @Column('timestamptz', {
    name: 'fecha_deteccion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_deteccion: Date;

  @ManyToOne(() => CapturaEntorno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_captura' })
  captura: CapturaEntorno;
}