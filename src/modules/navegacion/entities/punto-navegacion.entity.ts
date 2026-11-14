import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  BigIntPKColumn,
  BigIntTransformer,
} from '../../../common/transformers/bigint.transformer';
import { Navegacion } from './navegacion.entity';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: puntos_navegacion — un punto GPS de la traza de
 * una navegación (CU24), con la instrucción dictada/recibida
 * en ese punto. Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: orden > 0 | UNIQUE (id_navegacion, orden) |
 *           latitud -90..90 | longitud -180..180
 * ══════════════════════════════════════════════════════
 */
@Entity('puntos_navegacion')
export class PuntoNavegacion {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_punto: number;

  @Column({
    name: 'id_navegacion',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_navegacion: number;

  /** Posición del punto en el recorrido (1 en adelante) */
  @Column('smallint')
  orden: number;

  @Column('numeric', { precision: 9, scale: 6 })
  latitud: number;

  @Column('numeric', { precision: 9, scale: 6 })
  longitud: number;

  /** Ej: "Gire a la derecha en la esquina" (voz o guía) */
  @Column('text', { nullable: true })
  instruccion: string | null;

  /** Referencia del entorno detectada en el punto (IA/mobile) */
  @Column('text', { name: 'referencia_entorno', nullable: true })
  referencia_entorno: string | null;

  @ManyToOne(() => Navegacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_navegacion' })
  navegacion: Navegacion;
}
