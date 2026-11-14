import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BigIntPKColumn } from '../../../common/transformers/bigint.transformer';

/** Estados (BD: ck_categoria_estado) */
export type EstadoCategoriaVc = 'ACTIVA' | 'INACTIVA';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: categorias_visioncoach — categorías de ejercicios
 * (PERCEPCION, MOVILIDAD, LECTURA — seed del parche SQL).
 * Réplica de la tabla del modelo SQL.
 * ══════════════════════════════════════════════════════
 */
@Entity('categorias_visioncoach')
export class CategoriaVc {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_categoria: number;

  @Column('varchar', { length: 100, unique: true })
  nombre: string;

  @Column('text', { nullable: true })
  descripcion: string | null;

  @Column('varchar', { length: 20, default: 'ACTIVA' })
  estado: EstadoCategoriaVc;
}
