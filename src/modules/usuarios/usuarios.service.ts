import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { construirRespuestaPaginada, PaginationDto, RespuestaPaginada } from '../../common/dto/pagination.dto';
import { Perfil } from './entities/perfil.entity';
import { Usuario } from './entities/usuario.entity';
import {
  ActualizarPerfilDto,
  AdminActualizarUsuarioDto,
  AdminCrearUsuarioDto,
  CambiarContrasenaDto,
  UsuarioResponseDto,
} from './dto';

import { HistorialService } from '../historial/historial.service';
import { TIPOS_ACTIVIDAD } from '../historial/entities/historial-actividad.entity';
import { Institucion } from '../instituciones/entities/institucion.entity';

const BCRYPT_ROUNDS = 12;

/**
 * ══════════════════════════════════════════════════════
 * Servicio de usuarios y perfiles.
 *
 *   - Perfil propio:  ver / editar / cambiar contraseña (CU04)
 *   - Administración: listar / ver / actualizar / desactivar
 *                     (CU34–CU35, llamado desde el controller
 *                     que ya valida roles ADMIN/INSTITUCION)
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(Perfil)
    private readonly perfilesRepo: Repository<Perfil>,
    @InjectRepository(Institucion)
    private readonly institucionesRepo: Repository<Institucion>,
    private readonly dataSource: DataSource,
    private readonly historialService: HistorialService,
  ) {}

  // ═══════════════ PERFIL PROPIO (CU04) ═══════════════

  async obtenerPerfil(idUsuario: number): Promise<UsuarioResponseDto> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id_usuario: idUsuario },
      relations: { perfil: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return this.mapearARespuesta(usuario);
  }

  async actualizarPerfilPropio(
    idUsuario: number,
    dto: ActualizarPerfilDto,
  ): Promise<UsuarioResponseDto> {
    // Rechazar peticiones sin ningún campo (evita "updates fantasma")
    const hayCampos = Object.values(dto).some((v) => v !== undefined);
    if (!hayCampos) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar.',
      );
    }

    const perfil = await this.perfilesRepo.findOne({
      where: { id_usuario: idUsuario },
    });
    if (!perfil) {
      throw new NotFoundException('Perfil no encontrado.');
    }

    // Solo se aplican los campos enviados
    await this.perfilesRepo.update(perfil.id_perfil, {
      ...(dto.nombres !== undefined && { nombres: dto.nombres }),
      ...(dto.apellidos !== undefined && { apellidos: dto.apellidos }),
      ...(dto.telefono !== undefined && { telefono: dto.telefono }),
      ...(dto.fecha_nacimiento !== undefined && {
        fecha_nacimiento: dto.fecha_nacimiento,
      }),
      ...(dto.idioma !== undefined && { idioma: dto.idioma }),
    });

    await this.historialService.registrar(
      idUsuario,
      TIPOS_ACTIVIDAD.PERFIL_ACTUALIZADO,
      idUsuario,
      'Perfil actualizado.',
    );

    return this.obtenerPerfil(idUsuario);
  }

  async cambiarContrasena(
    idUsuario: number,
    dto: CambiarContrasenaDto,
  ): Promise<{ mensaje: string }> {
    if (dto.contrasena_nueva === dto.contrasena_actual) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual.',
      );
    }

    // contrasena_hash tiene select:false → query builder para traerla
    const usuario = await this.usuariosRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.contrasena_hash')
      .where('usuario.id_usuario = :id', { id: idUsuario })
      .getOne();

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const contrasenaValida = await bcrypt.compare(
      dto.contrasena_actual,
      usuario.contrasena_hash,
    );
    if (!contrasenaValida) {
      throw new BadRequestException('La contraseña actual es incorrecta.');
    }

    await this.usuariosRepo.update(idUsuario, {
      contrasena_hash: await bcrypt.hash(dto.contrasena_nueva, BCRYPT_ROUNDS),
    });

    await this.historialService.registrar(
      idUsuario,
      TIPOS_ACTIVIDAD.CONTRASENA_CAMBIADA,
      idUsuario,
      'Contraseña cambiada por el propio usuario.',
    );

    return { mensaje: 'Contraseña actualizada correctamente.' };
  }

  // ═══════════════ ADMINISTRACIÓN (CU34–CU35) ═══════════════

  async crearComoAdmin(
    dto: AdminCrearUsuarioDto,
    idAdmin: number,
  ): Promise<UsuarioResponseDto> {
    await this.validarInstitucion(dto.id_institucion);

    const existente = await this.usuariosRepo.findOne({
      where: { correo: dto.correo },
    });
    if (existente) {
      throw new BadRequestException('El correo ya está registrado.');
    }

    let idUsuarioCreado: number;
    try {
      idUsuarioCreado = await this.dataSource.transaction(async (em) => {
        const usuario = await em.save(
          em.create(Usuario, {
            correo: dto.correo,
            contrasena_hash: await bcrypt.hash(dto.contrasena, BCRYPT_ROUNDS),
            rol: dto.rol,
            estado: 'ACTIVO',
            id_institucion: dto.id_institucion ?? null,
            ultimo_acceso: null,
          }),
        );

        await em.save(
          em.create(Perfil, {
            id_usuario: usuario.id_usuario,
            nombres: dto.nombres,
            apellidos: dto.apellidos ?? null,
            idioma: 'es',
          }),
        );

        return Number(usuario.id_usuario);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new BadRequestException('El correo ya está registrado.');
      }
      throw error;
    }

    await this.historialService.registrar(
      idAdmin,
      TIPOS_ACTIVIDAD.USUARIO_REGISTRADO,
      idUsuarioCreado,
      `Usuario creado por un administrador (${dto.correo}).`,
    );

    return this.obtenerPorId(idUsuarioCreado);
  }

  async listar(paginacion: PaginationDto): Promise<RespuestaPaginada<UsuarioResponseDto>> {
    const qb = this.usuariosRepo
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.perfil', 'perfil')
      .orderBy('usuario.created_at', 'DESC')
      .skip(paginacion.skip)
      .take(paginacion.take);

    // Búsqueda libre: correo, nombres o apellidos
    if (paginacion.buscar) {
      qb.andWhere(
        '(usuario.correo ILIKE :buscar OR perfil.nombres ILIKE :buscar OR perfil.apellidos ILIKE :buscar)',
        { buscar: `%${paginacion.buscar}%` },
      );
    }

    const [usuarios, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      usuarios.map((u) => this.mapearARespuesta(u)),
      total,
      paginacion,
    );
  }

  async obtenerPorId(id: number): Promise<UsuarioResponseDto> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id_usuario: id },
      relations: { perfil: true },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado.`);
    }

    return this.mapearARespuesta(usuario);
  }

  async actualizarPerfilComoAdmin(
    id: number,
    dto: ActualizarPerfilDto,
  ): Promise<UsuarioResponseDto> {
    const hayCampos = Object.values(dto).some((v) => v !== undefined);
    if (!hayCampos) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar.',
      );
    }

    const perfil = await this.perfilesRepo.findOne({
      where: { id_usuario: id },
    });
    if (!perfil) {
      throw new NotFoundException(`Perfil del usuario ${id} no encontrado.`);
    }

    await this.perfilesRepo.update(perfil.id_perfil, {
      ...(dto.nombres !== undefined && { nombres: dto.nombres }),
      ...(dto.apellidos !== undefined && { apellidos: dto.apellidos }),
      ...(dto.telefono !== undefined && { telefono: dto.telefono }),
      ...(dto.fecha_nacimiento !== undefined && {
        fecha_nacimiento: dto.fecha_nacimiento,
      }),
      ...(dto.idioma !== undefined && { idioma: dto.idioma }),
    });

    return this.obtenerPorId(id);
  }

  async actualizarComoAdmin(
    id: number,
    dto: AdminActualizarUsuarioDto,
    idAdmin: number,
  ): Promise<UsuarioResponseDto> {
    const hayCampos = Object.values(dto).some((v) => v !== undefined);
    if (!hayCampos) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar.',
      );
    }

    const usuario = await this.usuariosRepo.findOne({
      where: { id_usuario: id },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado.`);
    }

    if (
      Number(id) === Number(idAdmin) &&
      (dto.estado === 'INACTIVO' || dto.estado === 'BLOQUEADO')
    ) {
      throw new ForbiddenException(
        'No puedes desactivar ni bloquear tu propia cuenta.',
      );
    }
    if (
      Number(id) === Number(idAdmin) &&
      dto.rol !== undefined &&
      dto.rol !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'No puedes quitar el rol ADMIN de tu propia cuenta.',
      );
    }

    await this.validarInstitucion(dto.id_institucion);

    try {
      await this.dataSource.transaction(async (em) => {
        if (dto.nombres !== undefined || dto.apellidos !== undefined) {
          await em.update(Perfil, { id_usuario: id }, {
            ...(dto.nombres !== undefined && { nombres: dto.nombres }),
            ...(dto.apellidos !== undefined && { apellidos: dto.apellidos }),
          });
        }

        await em.update(Usuario, id, {
        ...(dto.correo !== undefined && { correo: dto.correo }),
        ...(dto.rol !== undefined && { rol: dto.rol }),
        ...(dto.estado !== undefined && { estado: dto.estado }),
        // null explícito = quitar institución; undefined = no tocar
        ...(dto.id_institucion !== undefined && {
          id_institucion: dto.id_institucion,
        }),
        });
      });
    } catch (error) {
      // 23505 = unique_violation (correo duplicado)
      if ((error as { code?: string }).code === '23505') {
        throw new BadRequestException('El correo ya está registrado.');
      }
      // 23503 = foreign_key_violation (la institución no existe)
      if ((error as { code?: string }).code === '23503') {
        throw new BadRequestException('La institución indicada no existe.');
      }
      throw error;
    }

    return this.obtenerPorId(id);
  }

  /**
   * Borrado lógico (soft delete): pone estado INACTIVO.
   * Nunca borramos filas para conservar historial e integridad.
   */
  async desactivar(id: number, idAdmin: number): Promise<{ mensaje: string }> {
    if (Number(id) === Number(idAdmin)) {
      throw new ForbiddenException('No puedes desactivar tu propia cuenta.');
    }

    const resultado = await this.usuariosRepo.update(
      { id_usuario: id },
      { estado: 'INACTIVO' },
    );

    if (resultado.affected === 0) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado.`);
    }

    return { mensaje: `Usuario ${id} desactivado correctamente.` };
  }

  // ═══════════════════════ HELPERS ═══════════════════════

  /** Entidad → DTO público (sin hash ni campos técnicos) */
  private async validarInstitucion(
    idInstitucion: number | null | undefined,
  ): Promise<void> {
    if (idInstitucion == null) return;

    const existe = await this.institucionesRepo.exist({
      where: { id_institucion: idInstitucion },
    });
    if (!existe) {
      throw new BadRequestException('La institución indicada no existe.');
    }
  }

  private mapearARespuesta(usuario: Usuario): UsuarioResponseDto {
    return {
      id_usuario: Number(usuario.id_usuario),
      correo: usuario.correo,
      rol: usuario.rol,
      estado: usuario.estado,
      id_institucion: usuario.id_institucion ?? null,
      ultimo_acceso: usuario.ultimo_acceso,
      created_at: usuario.created_at,
      perfil: usuario.perfil
        ? {
            id_perfil: Number(usuario.perfil.id_perfil),
            nombres: usuario.perfil.nombres,
            apellidos: usuario.perfil.apellidos,
            telefono: usuario.perfil.telefono,
            fecha_nacimiento: usuario.perfil.fecha_nacimiento,
            idioma: usuario.perfil.idioma,
            foto_r2_key: usuario.perfil.foto_r2_key,
          }
        : null,
    };
  }
}
