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
import { ModeloIa } from './modelo-ia.entity';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: registros_ia — una fila por cada ejecución de un
 * modelo en FastAPI (la escribe monitoreo_service.py; el
 * backend SOLO la consulta — CU40).
 * Réplica de la tabla del modelo SQL.
 * ══════════════════════════════════════════════════════
 */
@Entity('registros_ia')
@Index('idx_registros_ia_fecha', ['fecha_ejecucion'])
export class RegistroIa {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_registro: number;

  @Column('bigint', {
    name: 'id_modelo',
    nullable: true,
    transformer: BigIntTransformer,
  })
  id_modelo: number | null;

  @Column('bigint', {
    name: 'id_usuario',
    nullable: true,
    transformer: BigIntTransformer,
  })
  id_usuario: number | null;

  @Column('bigint', {
    name: 'id_captura',
    nullable: true,
    transformer: BigIntTransformer,
  })
  id_captura: number | null;

  /** DETECCION_OBJETOS, OCR_TEXTO, RECONOCER_PRODUCTO, ... */
  @Column('varchar', { name: 'tipo_operacion', length: 50 })
  tipo_operacion: string;

  @Column('integer', { name: 'duracion_ms', nullable: true })
  duracion_ms: number | null;

  /** BD: ck_registro_estado — EXITO | ERROR | ADVERTENCIA */
  @Column('varchar', { name: 'resultado_estado', length: 20 })
  resultado_estado: string;

  /** CHECK BD: entre 0 y 1 (o NULL) */
  @Column('numeric', { precision: 5, scale: 4, nullable: true })
  confianza: number | null;

  @Column('text', { name: 'mensaje_error', nullable: true })
  mensaje_error: string | null;

  @Column('jsonb', { nullable: true })
  metadatos: Record<string, unknown> | null;

  @Column('timestamptz', {
    name: 'fecha_ejecucion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_ejecucion: Date;

  @ManyToOne(() => ModeloIa, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_modelo' })
  modelo: ModeloIa | null;
}
