import {
  Column,
  CreateDateColumn,
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
import { DeteccionIA } from '../../capturas/entities/deteccion-ia.entity';

/** Niveles de riesgo (BD: ck_alerta_nivel) */
export type NivelAlerta = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

/** Canales de emisión (BD: ck_alerta_canal) — los interpreta la app móvil */
export type CanalAlerta =
  | 'VOZ'
  | 'SONIDO'
  | 'VIBRACION'
  | 'VOZ_VIBRACION'
  | 'MULTICANAL';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: alertas — situaciones relevantes detectadas
 * (obstáculos, riesgos, emergencias). Núcleo de HU17–19.
 * Réplica de la tabla del modelo SQL (Sprint 2).
 *
 * Semántica de los campos clave:
 *   - nivel:     gravedad de la situación (BAJO → CRITICO)
 *   - prioridad: 1–5, orden de emisión (5 = máxima urgencia)
 *   - canal:     cómo comunicarla (la app ejecuta TTS/vibración/
 *                sonido según sus preferencias de accesibilidad)
 *   - atendida:  el móvil la marca TRUE tras reproducirla
 *                (nada se narra dos veces — HU17)
 *
 * CHECK BD: nivel (4) | prioridad BETWEEN 1 AND 5 | canal (5)
 * Índice parcial del SQL (producción):
 *   idx_alertas_pendientes ON (id_usuario, atendida) WHERE atendida = FALSE
 *   → aquí usamos el índice normal equivalente (id_usuario, atendida)
 * ══════════════════════════════════════════════════════
 */
@Entity('alertas')
@Index('idx_alertas_usuario_fecha', ['id_usuario', 'fecha_generacion'])
@Index('idx_alertas_pendientes', ['id_usuario', 'atendida'])
export class Alerta {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_alerta: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  /** Detección que originó la alerta (SET NULL: sobrevive al borrado) */
  @Column({
    name: 'id_deteccion',
    type: 'bigint',
    nullable: true,
    transformer: BigIntTransformer,
  })
  id_deteccion: number | null;

  /**
   * Tipo de situación — libre en el SQL (sin CHECK). Valores
   * definidos por el PriorizacionService (S2-T6):
   *   OBSTACULO | VEHICULO_CERCA | PERSONA_CERCA | SENAL_IMPORTANTE |
   *   AYUDA_SOLICITADA | SISTEMA
   */
  @Column('varchar', { name: 'tipo_alerta', length: 50 })
  tipo_alerta: string;

  @Column('varchar', { length: 20 })
  nivel: NivelAlerta;

  /** Texto comunicado al usuario (ya en español, listo para TTS) */
  @Column('text')
  mensaje: string;

  @Column('smallint')
  prioridad: number;

  @Column('varchar', { length: 30 })
  canal: CanalAlerta;

  /** true cuando la app móvil la reprodujo (voz/vibración) */
  @Column('boolean', { default: false })
  atendida: boolean;

  @Column('timestamptz', {
    name: 'fecha_generacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_generacion: Date;

  @Column('timestamptz', { name: 'fecha_atencion', nullable: true })
  fecha_atencion: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  // ─── Relaciones ───

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => DeteccionIA, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_deteccion' })
  deteccion: DeteccionIA | null;
}