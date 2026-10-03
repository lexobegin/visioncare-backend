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
import { Usuario } from '../../usuarios/entities/usuario.entity';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: comandos_voz — cada comando de voz ejecutado
 * con su intención detectada, resultado y confianza.
 * Réplica de la tabla del modelo SQL (Sprint 1).
 *
 * CHECK BD: confianza IS NULL OR confianza BETWEEN 0 AND 1
 * ══════════════════════════════════════════════════════
 */
@Entity('comandos_voz')
export class ComandoVoz {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_comando: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  /** Texto transcrito por el STT del dispositivo */
  @Column('text')
  comando: string;

  /** Código de la intención detectada (ej: RECONOCER_OBJETOS, DESCONOCIDA) */
  @Column('varchar', { length: 100, nullable: true })
  intencion: string | null;

  /** Resultado/respuesta generada para el usuario */
  @Column('text', { nullable: true })
  resultado: string | null;

  /** Confianza de la interpretación (0–1, numeric(5,4) en BD) */
  @Column('numeric', { precision: 5, scale: 4, nullable: true })
  confianza: number | null;

  @Column('timestamptz', {
    name: 'fecha_ejecucion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_ejecucion: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}