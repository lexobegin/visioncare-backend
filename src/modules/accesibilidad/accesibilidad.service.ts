import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PreferenciaAccesibilidad } from './entities/preferencia-accesibilidad.entity';
import {
  ActualizarPreferenciasDto,
  PreferenciasResponseDto,
} from './dto';

/**
 * ══════════════════════════════════════════════════════
 * Servicio de preferencias de accesibilidad.
 *
 * Lazy initialization: si el usuario aún no tiene registro
 * (p. ej. cuentas creadas antes de este módulo), el primer
 * GET crea sus preferencias con los valores por defecto de
 * la BD. Así la app móvil siempre recibe una configuración.
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class AccesibilidadService {
  constructor(
    @InjectRepository(PreferenciaAccesibilidad)
    private readonly preferenciasRepo: Repository<PreferenciaAccesibilidad>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
  ) {}

  async obtenerComoAdmin(idUsuario: number): Promise<PreferenciasResponseDto> {
    await this.validarUsuario(idUsuario);
    return this.obtener(idUsuario);
  }

  async actualizarComoAdmin(
    idUsuario: number,
    dto: ActualizarPreferenciasDto,
  ): Promise<PreferenciasResponseDto> {
    await this.validarUsuario(idUsuario);
    return this.actualizar(idUsuario, dto);
  }

  /**
   * Devuelve las preferencias del usuario; las crea con
   * defaults si todavía no existen (idempotente).
   */
  async obtener(idUsuario: number): Promise<PreferenciasResponseDto> {
    const preferencias = await this.obtenerOCrear(idUsuario);
    return this.mapearARespuesta(preferencias);
  }

  async actualizar(
    idUsuario: number,
    dto: ActualizarPreferenciasDto,
  ): Promise<PreferenciasResponseDto> {
    const hayCampos = Object.values(dto).some((v) => v !== undefined);
    if (!hayCampos) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar.',
      );
    }

    const preferencias = await this.obtenerOCrear(idUsuario);

    // Actualización parcial: solo los campos enviados
    await this.preferenciasRepo.update(preferencias.id_preferencia, {
      ...(dto.voz_habilitada !== undefined && { voz_habilitada: dto.voz_habilitada }),
      ...(dto.volumen_voz !== undefined && { volumen_voz: dto.volumen_voz }),
      ...(dto.velocidad_voz !== undefined && { velocidad_voz: dto.velocidad_voz }),
      ...(dto.alertas_sonoras !== undefined && { alertas_sonoras: dto.alertas_sonoras }),
      ...(dto.vibracion_habilitada !== undefined && {
        vibracion_habilitada: dto.vibracion_habilitada,
      }),
      ...(dto.intensidad_vibracion !== undefined && {
        intensidad_vibracion: dto.intensidad_vibracion,
      }),
      ...(dto.confirmaciones_por_voz !== undefined && {
        confirmaciones_por_voz: dto.confirmaciones_por_voz,
      }),
      ...(dto.modo_bajo_consumo !== undefined && {
        modo_bajo_consumo: dto.modo_bajo_consumo,
      }),
    });

    // Releer para devolver el estado final
    const actualizadas = await this.preferenciasRepo.findOne({
      where: { id_usuario: idUsuario },
    });

    return this.mapearARespuesta(actualizadas!);
  }

  // ═══════════════════════ HELPERS ═══════════════════════

  private async validarUsuario(idUsuario: number): Promise<void> {
    const existe = await this.usuariosRepo.exist({
      where: { id_usuario: idUsuario },
    });
    if (!existe) {
      throw new NotFoundException(
        `Usuario con id ${idUsuario} no encontrado.`,
      );
    }
  }

  private async obtenerOCrear(
    idUsuario: number,
  ): Promise<PreferenciaAccesibilidad> {
    const existentes = await this.preferenciasRepo.findOne({
      where: { id_usuario: idUsuario },
    });
    if (existentes) return existentes;

    // Creación con defaults (mismos valores que la tabla SQL)
    return this.preferenciasRepo.save(
      this.preferenciasRepo.create({ id_usuario: idUsuario }),
    );
  }

  private mapearARespuesta(
    preferencias: PreferenciaAccesibilidad,
  ): PreferenciasResponseDto {
    return {
      id_preferencia: Number(preferencias.id_preferencia),
      id_usuario: Number(preferencias.id_usuario),
      voz_habilitada: preferencias.voz_habilitada,
      volumen_voz: preferencias.volumen_voz,
      velocidad_voz: Number(preferencias.velocidad_voz), // numeric viene como string
      alertas_sonoras: preferencias.alertas_sonoras,
      vibracion_habilitada: preferencias.vibracion_habilitada,
      intensidad_vibracion: preferencias.intensidad_vibracion,
      confirmaciones_por_voz: preferencias.confirmaciones_por_voz,
      modo_bajo_consumo: preferencias.modo_bajo_consumo,
    };
  }
}
