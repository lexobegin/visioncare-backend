import {
  BadRequestException,
  ForbiddenException,
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
import { ContactoConfianza } from './entities/contacto-confianza.entity';
import {
  ActualizarContactoDto,
  ContactoQueryDto,
  ContactoResponseDto,
  CrearContactoDto,
} from './dto';

/**
 * ══════════════════════════════════════════════════════
 * Servicio de contactos de confianza (CU05, base de CU36).
 *
 * Reglas de propiedad:
 *   - Un usuario SOLO ve/gestiona sus propios contactos.
 *   - Acceder al contacto de otro → 404 (no revela existencia).
 *
 * Exportado: el módulo de ayuda (Sprint 3) usará
 * obtenerAutorizadosEmergencia() para notificar contactos.
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class ContactosService {
  constructor(
    @InjectRepository(ContactoConfianza)
    private readonly contactosRepo: Repository<ContactoConfianza>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
  ) {}

  // ═══════════════════════ CREAR ═══════════════════════

  async crear(
    idUsuario: number,
    dto: CrearContactoDto,
  ): Promise<ContactoResponseDto> {
    const contacto = await this.contactosRepo.save(
      this.contactosRepo.create({
        id_usuario: idUsuario,
        nombre: dto.nombre,
        parentesco: dto.parentesco,
        telefono: dto.telefono,
        correo: dto.correo,
        prioridad: dto.prioridad ?? 1,
        autorizado_ubicacion: dto.autorizado_ubicacion ?? false,
        autorizado_emergencias: dto.autorizado_emergencias ?? true,
      }),
    );

    return this.mapearARespuesta(contacto);
  }

  // ═══════════════════════ CONSULTAS ═══════════════════════

  /** Mis contactos (ordenados por prioridad de notificación) */
  async listar(
    idUsuario: number,
    query: ContactoQueryDto,
  ): Promise<RespuestaPaginada<ContactoResponseDto>> {
    const qb = this.contactosRepo
      .createQueryBuilder('contacto')
      .where('contacto.id_usuario = :idUsuario', { idUsuario })
      .orderBy('contacto.prioridad', 'ASC')
      .addOrderBy('contacto.created_at', 'ASC')
      .skip(query.skip)
      .take(query.take);

    if (query.estado && query.estado !== 'TODOS') {
      qb.andWhere('contacto.estado = :estado', { estado: query.estado });
    }

    if (query.buscar) {
      qb.andWhere(
        '(contacto.nombre ILIKE :buscar OR contacto.correo ILIKE :buscar OR contacto.telefono ILIKE :buscar)',
        { buscar: `%${query.buscar}%` },
      );
    }

    const [contactos, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      contactos.map((c) => this.mapearARespuesta(c)),
      total,
      query,
    );
  }

  /** CU36 — Contactos de un usuario (solo lo llama el controller con roles) */
  async listarPorUsuario(
    idUsuarioObjetivo: number,
    query: ContactoQueryDto,
  ): Promise<RespuestaPaginada<ContactoResponseDto>> {
    const existe = await this.usuariosRepo.exist({
      where: { id_usuario: idUsuarioObjetivo },
    });
    if (!existe) {
      throw new NotFoundException(
        `Usuario con id ${idUsuarioObjetivo} no encontrado.`,
      );
    }

    return this.listar(idUsuarioObjetivo, query);
  }

  async obtenerPorId(
    idContacto: number,
    idUsuario: number,
  ): Promise<ContactoResponseDto> {
    const contacto = await this.buscarPropio(idContacto, idUsuario);
    return this.mapearARespuesta(contacto);
  }

  // ═══════════════════════ ACTUALIZAR ═══════════════════════

  async actualizar(
    idContacto: number,
    idUsuario: number,
    dto: ActualizarContactoDto,
  ): Promise<ContactoResponseDto> {
    const hayCampos = Object.values(dto).some((v) => v !== undefined);
    if (!hayCampos) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar.',
      );
    }

    const contacto = await this.buscarPropio(idContacto, idUsuario);

    try {
      await this.contactosRepo.update(contacto.id_contacto, {
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.parentesco !== undefined && { parentesco: dto.parentesco }),
        ...(dto.telefono !== undefined && { telefono: dto.telefono }),
        ...(dto.correo !== undefined && { correo: dto.correo }),
        ...(dto.prioridad !== undefined && { prioridad: dto.prioridad }),
        ...(dto.autorizado_ubicacion !== undefined && {
          autorizado_ubicacion: dto.autorizado_ubicacion,
        }),
        ...(dto.autorizado_emergencias !== undefined && {
          autorizado_emergencias: dto.autorizado_emergencias,
        }),
      });
    } catch (error) {
      // 23514 = check_violation → dejó el contacto sin ningún medio
      if ((error as { code?: string }).code === '23514') {
        throw new BadRequestException(
          'El contacto debe conservar al menos un medio de contacto (teléfono o correo).',
        );
      }
      throw error;
    }

    return this.obtenerPorId(idContacto, idUsuario);
  }

  // ═══════════════ ESTADO (borrado lógico) ═══════════════

  async desactivar(
    idContacto: number,
    idUsuario: number,
  ): Promise<{ mensaje: string }> {
    const contacto = await this.buscarPropio(idContacto, idUsuario);

    await this.contactosRepo.update(contacto.id_contacto, {
      estado: 'INACTIVO',
    });

    return { mensaje: `Contacto ${idContacto} desactivado correctamente.` };
  }

  async activar(
    idContacto: number,
    idUsuario: number,
  ): Promise<{ mensaje: string }> {
    const contacto = await this.buscarPropio(idContacto, idUsuario);

    await this.contactosRepo.update(contacto.id_contacto, {
      estado: 'ACTIVO',
    });

    return { mensaje: `Contacto ${idContacto} activado correctamente.` };
  }

  // ═══════════ PARA EL MÓDULO DE AYUDA (Sprint 3) ═══════════

  /**
   * Contactos ACTIVOS autorizados para emergencias,
   * ordenados por prioridad. Lo consumirá el módulo de
   * solicitudes de ayuda (CU20, Sprint 3).
   */
  async obtenerAutorizadosEmergencia(
    idUsuario: number,
  ): Promise<ContactoConfianza[]> {
    return this.contactosRepo.find({
      where: {
        id_usuario: idUsuario,
        estado: 'ACTIVO',
        autorizado_emergencias: true,
      },
      order: { prioridad: 'ASC' },
    });
  }

  // ═══════════════════════ HELPERS ═══════════════════════

  /** Busca un contacto verificando que pertenezca al usuario */
  private async buscarPropio(
    idContacto: number,
    idUsuario: number,
  ): Promise<ContactoConfianza> {
    const contacto = await this.contactosRepo.findOne({
      where: { id_contacto: idContacto },
    });

    // 404 (no 403) tanto si no existe como si es de otro usuario:
    // evita filtrar la existencia de recursos ajenos.
    if (!contacto || Number(contacto.id_usuario) !== Number(idUsuario)) {
      throw new NotFoundException(
        `Contacto con id ${idContacto} no encontrado.`,
      );
    }

    return contacto;
  }

  private mapearARespuesta(contacto: ContactoConfianza): ContactoResponseDto {
    return {
      id_contacto: Number(contacto.id_contacto),
      id_usuario: Number(contacto.id_usuario),
      nombre: contacto.nombre,
      parentesco: contacto.parentesco,
      telefono: contacto.telefono,
      correo: contacto.correo,
      prioridad: contacto.prioridad,
      autorizado_ubicacion: contacto.autorizado_ubicacion,
      autorizado_emergencias: contacto.autorizado_emergencias,
      estado: contacto.estado,
    };
  }
}