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
 * Entidad: detecciones_ia — cada objeto detectado por los
 * modelos (YOLO) sobre una captura. Réplica del modelo SQL.
 *
 * CHECK BD: confianza BETWEEN 0 AND 1
 *           bbox: todos NULL o todos válidos (x_max > x_min)
 * ══════════════════════════════════════════════════════
 */
@Entity('detecciones_ia')
@Index('idx_detecciones_captura', ['id_captura'])
@Index('idx_detecciones_categoria', ['categoria'])
export class DeteccionIA {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_deteccion: number;

  @Column({
    name: 'id_captura',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_captura: number;

  /** Etiqueta original del modelo (ej: 'person') */
  @Column('varchar', { length: 150 })
  etiqueta: string;

  /** Categoría general (ej: 'persona', 'vehiculo') */
  @Column('varchar', { length: 80, nullable: true })
  categoria: string | null;

  @Column('numeric', { precision: 5, scale: 4 })
  confianza: number;

  // ─── Bounding box (posición del objeto en la imagen) ───
  @Column('numeric', { name: 'x_min', precision: 10, scale: 4, nullable: true })
  x_min: number | null;

  @Column('numeric', { name: 'y_min', precision: 10, scale: 4, nullable: true })
  y_min: number | null;

  @Column('numeric', { name: 'x_max', precision: 10, scale: 4, nullable: true })
  x_max: number | null;

  @Column('numeric', { name: 'y_max', precision: 10, scale: 4, nullable: true })
  y_max: number | null;

  @Column('varchar', { name: 'modelo_nombre', length: 150, nullable: true })
  modelo_nombre: string | null;

  @Column('varchar', { name: 'modelo_version', length: 50, nullable: true })
  modelo_version: string | null;

  @Column('timestamptz', {
    name: 'fecha_deteccion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_deteccion: Date;

  @ManyToOne(() => CapturaEntorno, (captura) => captura.detecciones, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_captura' })
  captura: CapturaEntorno;
}