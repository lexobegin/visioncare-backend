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
 * Estimaciones de autenticidad (BD: ck_autenticidad):
 *   - PROBABLEMENTE_AUTENTICO → patrones visuales consistentes
 *   - PROBABLEMENTE_SOSPECHOSO → inconsistencias detectadas
 *   - INDETERMINADO → confianza baja / imagen insuficiente
 */
export type EstimacionAutenticidad =
  | 'PROBABLEMENTE_AUTENTICO'
  | 'PROBABLEMENTE_SOSPECHOSO'
  | 'INDETERMINADO';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: billetes_reconocidos — reconocimiento de billetes
 * (moneda y denominación) + estimación VISUAL de autenticidad.
 * Réplica de la tabla del modelo SQL (Sprint 2).
 *
 * ⚠️ ADVERTENCIA DEL MODELO SQL (se comunica en la UI móvil):
 *    "No constituye certificación de autenticidad."
 *    La heurística visual es orientativa — nunca un veredicto.
 *
 * CHECK BD: confianza 0–1 | autenticidad IN (3 estados) |
 *           confianza_autenticidad 0–1 o NULL
 * ══════════════════════════════════════════════════════
 */
@Entity('billetes_reconocidos')
@Index('idx_billetes_captura', ['id_captura'])
export class BilleteReconocido {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_billete: number;

  @Column({
    name: 'id_captura',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_captura: number;

  /** Moneda detectada (ej: 'BOB', 'USD') */
  @Column('varchar', { length: 30, nullable: true })
  moneda: string | null;

  /** Denominación detectada (ej: '100', '10', '20') */
  @Column('varchar', { length: 50, nullable: true })
  denominacion: string | null;

  @Column('numeric', { precision: 5, scale: 4, nullable: true })
  confianza: number | null;

  @Column('varchar', {
    name: 'autenticidad_estimacion',
    length: 35,
    nullable: true,
  })
  autenticidad_estimacion: EstimacionAutenticidad | null;

  /** Confianza de la propia estimación de autenticidad */
  @Column('numeric', {
    name: 'confianza_autenticidad',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  confianza_autenticidad: number | null;

  /** Detalles del análisis visual (marcas de agua, texturas, inconsistencias) */
  @Column('text', { nullable: true })
  observaciones: string | null;

  @Column('timestamptz', {
    name: 'fecha_deteccion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_deteccion: Date;

  @ManyToOne(() => CapturaEntorno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_captura' })
  captura: CapturaEntorno;
}