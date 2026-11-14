import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BigIntTransformer } from '../../../common/transformers/bigint.transformer';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { InsigniaVc } from './insignia.entity';

/**
 * ══════════════════════════════════════════════════════
 * Entidad: usuarios_insignias — N:M usuario↔insignia con PK
 * compuesta (sin identity, réplica del modelo SQL).
 * ══════════════════════════════════════════════════════
 */
@Entity('usuarios_insignias')
@Index('idx_usuarios_insignias_usuario', ['id_usuario'])
export class UsuarioInsigniaVc {
  @Column('bigint', { primary: true, transformer: BigIntTransformer })
  id_usuario: number;

  @Column('bigint', { primary: true, transformer: BigIntTransformer })
  id_insignia: number;

  @Column('timestamptz', {
    name: 'fecha_obtencion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_obtencion: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => InsigniaVc, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_insignia' })
  insignia: InsigniaVc;
}
