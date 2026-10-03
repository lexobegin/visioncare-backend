import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  construirRespuestaPaginada,
  PaginationDto,
  RespuestaPaginada,
} from '../../common/dto/pagination.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Institucion } from './entities/institucion.entity';
import {
  ActualizarInstitucionDto,
  CrearInstitucionDto,
  InstitucionResponseDto,
} from './dto';

/**
 * ══════════════════════════════════════════════════════
 * Servicio de instituciones (CRUD administrativo).
 * - Borrado lógico: estado ACTIVA ↔ INACTIVA (nunca DELETE físico)
 * - Incluye total_usuarios por institución (dashboard web)
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class InstitucionesService {
  constructor(
    @InjectRepository(Institucion)
    private readonly institucionesRepo: Repository<Institucion>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
  ) {}

  // ═══════════════════════ CREAR ═══════════════════════

  async crear(dto: CrearInstitucionDto): Promise<InstitucionResponseDto> {
    try {
      const institucion = await this.institucionesRepo.save(
        this.institucionesRepo.create({
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          telefono: dto.telefono,
          correo: dto.correo,
          direccion: dto.direccion,
        }),
      );

      return this.mapearARespuesta(institucion, 0);
    } catch (error) {
      // 23505 = unique_violation (nombre duplicado)
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'Ya existe una institución con ese nombre.',
        );
      }
      throw error;
    }
  }

  // ═══════════════════════ CONSULTAS ═══════════════════════

  async listar(
    paginacion: PaginationDto,
  ): Promise<RespuestaPaginada<InstitucionResponseDto>> {
    const qb = this.institucionesRepo
      .createQueryBuilder('institucion')
      .orderBy('institucion.created_at', 'DESC')
      .skip(paginacion.skip)
      .take(paginacion.take);

    if (paginacion.buscar) {
      qb.andWhere(
        '(institucion.nombre ILIKE :buscar OR institucion.correo ILIKE :buscar)',
        { buscar: `%${paginacion.buscar}%` },
      );
    }

    const [instituciones, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      await this.agregarConteos(instituciones),
      total,
      paginacion,
    );
  }

  async obtenerPorId(id: number): Promise<InstitucionResponseDto> {
    const institucion = await this.institucionesRepo.findOne({
      where: { id_institucion: id },
    });

    if (!institucion) {
      throw new NotFoundException(
        `Institución con id ${id} no encontrada.`,
      );
    }

    const [conConteo] = await this.agregarConteos([institucion]);
    return conConteo;
  }

  // ═══════════════════════ ACTUALIZAR ═══════════════════════

  async actualizar(
    id: number,
    dto: ActualizarInstitucionDto,
  ): Promise<InstitucionResponseDto> {
    const hayCampos = Object.values(dto).some((v) => v !== undefined);
    if (!hayCampos) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar.',
      );
    }

    const institucion = await this.institucionesRepo.findOne({
      where: { id_institucion: id },
    });
    if (!institucion) {
      throw new NotFoundException(`Institución con id ${id} no encontrada.`);
    }

    try {
      await this.institucionesRepo.update(id, {
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.telefono !== undefined && { telefono: dto.telefono }),
        ...(dto.correo !== undefined && { correo: dto.correo }),
        ...(dto.direccion !== undefined && { direccion: dto.direccion }),
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Ya existe una institución con ese nombre.');
      }
      throw error;
    }

    return this.obtenerPorId(id);
  }

  // ═══════════════ ESTADO (borrado lógico) ═══════════════

  async desactivar(id: number): Promise<{ mensaje: string }> {
    const resultado = await this.institucionesRepo.update(
      { id_institucion: id },
      { estado: 'INACTIVA' },
    );

    if (resultado.affected === 0) {
      throw new NotFoundException(`Institución con id ${id} no encontrada.`);
    }

    return { mensaje: `Institución ${id} desactivada correctamente.` };
  }

  async activar(id: number): Promise<{ mensaje: string }> {
    const resultado = await this.institucionesRepo.update(
      { id_institucion: id },
      { estado: 'ACTIVA' },
    );

    if (resultado.affected === 0) {
      throw new NotFoundException(`Institución con id ${id} no encontrada.`);
    }

    return { mensaje: `Institución ${id} activada correctamente.` };
  }

  // ═══════════════════════ HELPERS ═══════════════════════

  /**
   * Cuenta usuarios por institución en UNA sola consulta
   * (evita N+1 en listados). GROUP BY sobre usuarios.
   */
  private async agregarConteos(
    instituciones: Institucion[],
  ): Promise<InstitucionResponseDto[]> {
    const ids = instituciones.map((i) => Number(i.id_institucion));

    let conteos = new Map<number, number>();
    if (ids.length > 0) {
      const filas = await this.usuariosRepo
        .createQueryBuilder('usuario')
        .select('usuario.id_institucion', 'id_institucion')
        .addSelect('COUNT(*)', 'total')
        .where('usuario.id_institucion IN (:...ids)', { ids })
        .groupBy('usuario.id_institucion')
        .getRawMany<{ id_institucion: string; total: string }>();

      conteos = new Map(
        filas.map((f) => [Number(f.id_institucion), Number(f.total)]),
      );
    }

    return instituciones.map((i) =>
      this.mapearARespuesta(i, conteos.get(Number(i.id_institucion)) ?? 0),
    );
  }

  private mapearARespuesta(
    institucion: Institucion,
    totalUsuarios: number,
  ): InstitucionResponseDto {
    return {
      id_institucion: Number(institucion.id_institucion),
      nombre: institucion.nombre,
      descripcion: institucion.descripcion,
      telefono: institucion.telefono,
      correo: institucion.correo,
      direccion: institucion.direccion,
      estado: institucion.estado,
      total_usuarios: totalUsuarios,
      created_at: institucion.created_at,
    };
  }
}