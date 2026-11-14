import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  BigIntPKColumn,
  BigIntTransformer,
} from '../../../common/transformers/bigint.transformer';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Ubicacion } from '../../ayuda/entities/ubicacion.entity';
import { EvidenciaIncidente } from './evidencia-incidente.entity';

/** Severidades (BD: ck_incidente_severidad) */
export type SeveridadIncidente = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

/** Estados (BD: ck_incidente_estado) */
export type EstadoIncidente =
  | 'ABIERTO'      // recién reportado
  | 'EN_REVISION'  // un gestor (web) lo está atendiendo
  | 'RESUELTO'     // la situación se resolvió
  | 'CERRADO';     // cerrado administrativamente

/**
 * ══════════════════════════════════════════════════════
 * Entidad: incidentes — situaciones de seguridad reportadas
 * por el usuario desde el móvil (CU22) y gestionadas desde
 * la web (CU38). Réplica de la tabla del modelo SQL.
 *
 * CHECK BD: severidad BAJA/MEDIA/ALTA/CRITICA |
 *           estado ABIERTO/EN_REVISION/RESUELTO/CERRADO
 * ══════════════════════════════════════════════════════
 */
@Entity('incidentes')
@Index('idx_incidentes_usuario_fecha', ['id_usuario', 'fecha_incidente'])
@Index('idx_incidentes_estado', ['estado'])
export class Incidente {
  @PrimaryGeneratedColumn(BigIntPKColumn)
  id_incidente: number;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    transformer: BigIntTransformer,
  })
  id_usuario: number;

  /** Ubicación al momento del reporte (SET NULL si se borra) */
  @Column({
    name: 'id_ubicacion',
    type: 'bigint',
    nullable: true,
    transformer: BigIntTransformer,
  })
  id_ubicacion: number | null;

  /** Tipo libre: OBSTRUCCION, CAIDA, PERDIDA, ACOSO, ... (VARCHAR 80) */
  @Column('varchar', { name: 'tipo_incidente', length: 80 })
  tipo_incidente: string;

  @Column('text', { nullable: true })
  descripcion: string | null;

  @Column('varchar', { length: 20, default: 'MEDIA' })
  severidad: SeveridadIncidente;

  @Column('varchar', { length: 20, default: 'ABIERTO' })
  estado: EstadoIncidente;

  @Column('timestamptz', {
    name: 'fecha_incidente',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_incidente: Date;

  /** Se establece al pasar a RESUELTO o CERRADO */
  @Column('timestamptz', { name: 'fecha_cierre', nullable: true })
  fecha_cierre: Date | null;

  // ─── Relaciones ───

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Ubicacion, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_ubicacion' })
  ubicacion: Ubicacion | null;

  /** Evidencias multimedia (fotos, video, audio, PDF) en R2 */
  @OneToMany(
    () => EvidenciaIncidente,
    (evidencia) => evidencia.incidente,
  )
  evidencias: EvidenciaIncidente[];
}
