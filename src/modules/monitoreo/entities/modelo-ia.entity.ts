import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BigIntPKColumn } from '../../../common/transformers/bigint.transformer';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: modelos_ia — catálogo de modelos desplegados en
 * FastAPI. La tabla la gestiona el servicio IA al arrancar
 * (init_db.py); el backend SOLO la consulta (CU40).
 * Réplica de la tabla del modelo SQL.
 * ══════════════════════════════════════════════════════
 */
@Entity('modelos_ia')
export class ModeloIa {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_modelo: number;

  @Column('varchar', { length: 150 })
  nombre: string;

  @Column('varchar', { name: 'tipo_modelo', length: 50 })
  tipo_modelo: string;

  @Column('varchar', { length: 50 })
  version: string;

  @Column('varchar', { length: 100, nullable: true })
  proveedor: string | null;

  @Column('text', { name: 'ruta_modelo', nullable: true })
  ruta_modelo: string | null;

  /** CHECK BD: entre 0 y 1 (o NULL) */
  @Column('numeric', {
    name: 'precision_aproximada',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  precision_aproximada: number | null;

  /** BD: ck_modelo_estado — ACTIVO | INACTIVO | PRUEBA */
  @Column('varchar', { length: 20, default: 'ACTIVO' })
  estado: string;

  @Column('timestamptz', { name: 'fecha_publicacion', nullable: true })
  fecha_publicacion: Date | null;

  @Column('timestamptz', {
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @Column('timestamptz', {
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
