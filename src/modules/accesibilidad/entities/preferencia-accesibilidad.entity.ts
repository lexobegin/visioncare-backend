import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BigIntPKColumn, BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Usuario } from '../../usuarios/entities/usuario.entity';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: preferencias_accesibilidad (1:1 con usuarios)
 * Réplica de la tabla del modelo SQL de VisionCare AI.
 *
 * Restricciones de la BD (CHECK):
 *   - volumen_voz          BETWEEN 0 AND 100
 *   - velocidad_voz        BETWEEN 0.50 AND 3.00
 *   - intensidad_vibracion BETWEEN 0 AND 100
 * ══════════════════════════════════════════════════════
 */
@Entity('preferencias_accesibilidad')
export class PreferenciaAccesibilidad {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_preferencia: number;

  /** FK única hacia usuarios (relación 1:1, ON DELETE CASCADE) */
  @Column({
    name: 'id_usuario',
    type: 'bigint',
    unique: true,
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  /** Feedback hablado del sistema (TTS) */
  @Column('boolean', { name: 'voz_habilitada', default: true })
  voz_habilitada: boolean;

  @Column('smallint', { name: 'volumen_voz', default: 80 })
  volumen_voz: number;

  /** Velocidad de reproducción de la voz (0.50–3.00) */
  @Column('numeric', { name: 'velocidad_voz', precision: 4, scale: 2, default: 1.0 })
  velocidad_voz: number;

  @Column('boolean', { name: 'alertas_sonoras', default: true })
  alertas_sonoras: boolean;

  @Column('boolean', { name: 'vibracion_habilitada', default: true })
  vibracion_habilitada: boolean;

  @Column('smallint', { name: 'intensidad_vibracion', default: 80 })
  intensidad_vibracion: number;

  /** Confirmación de acciones mediante comandos de voz */
  @Column('boolean', { name: 'confirmaciones_por_voz', default: true })
  confirmaciones_por_voz: boolean;

  /** Reduce consumo de batería limitando procesos pesados */
  @Column('boolean', { name: 'modo_bajo_consumo', default: false })
  modo_bajo_consumo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;

  @OneToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}