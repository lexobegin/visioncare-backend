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
 * Entidad: productos_reconocidos — productos y objetos
 * comerciales identificados (empaques, envases, frutas...).
 * Réplica de la tabla del modelo SQL (Sprint 2).
 * ══════════════════════════════════════════════════════
 */
@Entity('productos_reconocidos')
@Index('idx_productos_captura', ['id_captura'])
export class ProductoReconocido {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_producto_reconocido: number;

  @Column({
    name: 'id_captura',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_captura: number;

  /** Nombre del producto (de OCR del empaque o de la clase COCO) */
  @Column('varchar', { name: 'nombre_producto', length: 150, nullable: true })
  nombre_producto: string | null;

  /** Marca detectada vía OCR del empaque */
  @Column('varchar', { length: 120, nullable: true })
  marca: string | null;

  /** Categoría general: 'bebida', 'fruta', 'snack', 'limpieza'... */
  @Column('varchar', { length: 100, nullable: true })
  categoria: string | null;

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