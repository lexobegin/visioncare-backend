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
 * Entidad: colores_reconocidos — color(es) identificados
 * en la captura (prendas, objetos). Réplica del SQL S2.
 *
 * color_principal: nombre en español del color dominante
 * colores_secundarios: lista separada por comas
 * ══════════════════════════════════════════════════════
 */
@Entity('colores_reconocidos')
@Index('idx_colores_captura', ['id_captura'])
export class ColorReconocido {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_color_reconocido: number;

  @Column({
    name: 'id_captura',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_captura: number;

  /** Color dominante en español: 'azul', 'rojo', 'negro'... */
  @Column('varchar', { name: 'color_principal', length: 50 })
  color_principal: string;

  /** Colores secundarios separados por comas: 'blanco, gris' */
  @Column('text', { name: 'colores_secundarios', nullable: true })
  colores_secundarios: string | null;

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