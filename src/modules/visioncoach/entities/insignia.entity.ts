import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BigIntPKColumn } from '../../../common/transformers/bigint.transformer';

/** Estados (BD: ck_insignia_estado) */
export type EstadoInsigniaVc = 'ACTIVA' | 'INACTIVA';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: insignias_visioncoach — logros del catálogo.
 * `condicion` tiene formato "campo >= N" y el backend la
 * evalúa contra progreso_visioncoach (campos válidos: nivel,
 * puntos_totales, racha_actual, mejor_racha,
 * ejercicios_completados). Seed en el parche SQL.
 * Réplica de la tabla del modelo SQL.
 * ══════════════════════════════════════════════════════
 */
@Entity('insignias_visioncoach')
export class InsigniaVc {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_insignia: number;

  @Column('varchar', { length: 100, unique: true })
  nombre: string;

  @Column('text')
  descripcion: string;

  /** Key R2 del ícono (fotos de perfil/insignias reutilizarán R2) */
  @Column('text', { name: 'icono_r2_key', nullable: true })
  icono_r2_key: string | null;

  /** Condición de obtención: "campo >= N" */
  @Column('text', { nullable: true })
  condicion: string | null;

  @Column('varchar', { length: 20, default: 'ACTIVA' })
  estado: EstadoInsigniaVc;
}
