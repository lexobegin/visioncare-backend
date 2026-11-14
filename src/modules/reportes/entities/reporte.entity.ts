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
import { Usuario } from '../../usuarios/entities/usuario.entity';

/** Formatos (BD: ck_reporte_formato) */
export type FormatoReporte = 'JSON' | 'PDF' | 'CSV' | 'XLSX';

/** Tipos que genera el backend (CU39) */
export const TIPOS_REPORTE = [
  'USO_APLICACION',
  'PROGRESO_VISIONCOACH',
  'INCIDENTES',
  'MONITOREO_IA',
] as const;

export type TipoReporte = (typeof TIPOS_REPORTE)[number];

/**
 * ══════════════════════════════════════════════════════
 * Entidad: reportes — reportes de uso/rendimiento (CU39).
 * `datos` guarda el JSONB calculado (metricas + filas);
 * CSV se sube a R2 y queda en `r2_key`.
 * Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: formato JSON/PDF/CSV/XLSX |
 *           periodo_fin >= periodo_inicio (si ambos)
 * ══════════════════════════════════════════════════════
 */
@Entity('reportes')
@Index('idx_reportes_institucion_fecha', ['id_institucion', 'fecha_generacion'])
@Index('idx_reportes_usuario_fecha', ['id_usuario_generador', 'fecha_generacion'])
export class Reporte {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_reporte: number;

  @Column('bigint', {
    name: 'id_usuario_generador',
    nullable: true,
    transformer: BigIntTransformer,
  })
  id_usuario_generador: number | null;

  @Column('bigint', { name: 'id_institucion', nullable: true, transformer: BigIntTransformer })
  id_institucion: number | null;

  @Column('varchar', { name: 'tipo_reporte', length: 50 })
  tipo_reporte: string;

  /** Columnas DATE: se manejan como 'YYYY-MM-DD' (sin corrimiento TZ) */
  @Column('date', { name: 'periodo_inicio', nullable: true })
  periodo_inicio: string | null;

  @Column('date', { name: 'periodo_fin', nullable: true })
  periodo_fin: string | null;

  @Column('varchar', { length: 200 })
  titulo: string;

  @Column('text', { nullable: true })
  resumen: string | null;

  /** JSONB: { periodo, generado_en, metricas, filas } */
  @Column('jsonb', { nullable: true })
  datos: Record<string, unknown> | null;

  @Column('text', { name: 'r2_key', nullable: true })
  r2_key: string | null;

  @Column('varchar', { length: 20, default: 'JSON' })
  formato: FormatoReporte;

  @Column('timestamptz', {
    name: 'fecha_generacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_generacion: Date;

  // ─── Relaciones ───

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_usuario_generador' })
  generador: Usuario;
}
