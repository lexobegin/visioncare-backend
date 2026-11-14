import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Usuario } from '../usuarios/entities/usuario.entity';
import { Ubicacion } from './entities/ubicacion.entity';
import type { CompartirUbicacionDto } from './dto/compartir-ubicacion.dto';

/** Un ping con más minutos que esto ya no se considera "en vivo" */
const VENTANA_DEFECTO_MIN = 15;
const VENTANA_MAX_MIN = 120;
const TRAIL_DEFECTO = 30;
const TRAIL_MAX = 100;

/** Contacto autorizado para llamadas desde el mapa (CU21) */
export interface ContactoUbicable {
  nombre: string;
  parentesco: string | null;
  telefono: string;
  correo: string | null;
}

/** Usuario con ubicación reciente (para el mapa web) */
export interface UsuarioUbicacion {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: string;
  telefono: string | null;
  latitud: number;
  longitud: number;
  precision_metros: number | null;
  fecha_registro: string;
  minutos_desde: number;
  contactos_autorizados: ContactoUbicable[];
}

/**
 * ══════════════════════════════════════════════════════
 * CU21 — Compartir ubicación autorizada (Sprint 3).
 *
 * El móvil (asistente continuo activo o toggle manual) envía
 * pings GPS a POST /ayuda/ubicacion. El personal (ADMIN e
 * INSTITUCION) ve en el mapa web quién está "en vivo" (ping
 * dentro de la ventana) con botón de llamada al usuario y a
 * sus contactos de confianza autorizados_ubicacion.
 *
 * Alcances (mismo patrón que reportes.service):
 *   - ADMIN: todos los usuarios.
 *   - INSTITUCION: solo usuarios de su institución.
 *   - USUARIO: su propia ruta (historial de ubicaciones).
 *
 * PRIVACIDAD: solo se comparte lo que el usuario autoriza —
 * los pings llegan SOLO mientras el usuario activó el
 * asistente o el toggle; los contactos ven el teléfono solo
 * si tienen autorizado_ubicacion = TRUE.
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class UbicacionesService {
  private readonly logger = new Logger(UbicacionesService.name);

  constructor(
    @InjectRepository(Ubicacion)
    private readonly ubicacionesRepo: Repository<Ubicacion>,
    private readonly dataSource: DataSource,
  ) {}

  /** POST /ayuda/ubicacion — guarda un ping GPS del usuario */
  async registrar(
    idUsuario: number,
    dto: CompartirUbicacionDto,
  ): Promise<Ubicacion> {
    const fila = await this.ubicacionesRepo.save(
      this.ubicacionesRepo.create({
        id_usuario: idUsuario,
        latitud: dto.latitud,
        longitud: dto.longitud,
        precision_metros: dto.precision_metros ?? null,
        altitud_metros: dto.altitud_metros ?? null,
      }),
    );
    return fila;
  }

  /**
   * GET /ayuda/ubicaciones-activas — usuarios con ping reciente
   * (en vivo) + contactos autorizados para llamar. ADMIN ve
   * todos; INSTITUCION solo su institución.
   */
  async activos(
    usuario: Usuario,
    ventanaMin?: number,
  ): Promise<UsuarioUbicacion[]> {
    const ventana = Math.min(
      Math.max(ventanaMin ?? VENTANA_DEFECTO_MIN, 1),
      VENTANA_MAX_MIN,
    );
    const idInstitucion =
      usuario.rol === 'ADMIN' ? null : (usuario.id_institucion ?? null);

    const filas = await this.dataSource.query(
      `SELECT DISTINCT ON (u.id_usuario)
              u.id_usuario::int AS id_usuario,
              COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), u.correo) AS nombre,
              u.correo, u.rol, u.estado,
              p.telefono AS telefono_usuario,
              ub.latitud::float8 AS latitud,
              ub.longitud::float8 AS longitud,
              ub.precision_metros::float8 AS precision_metros,
              ub.fecha_registro,
              ROUND(EXTRACT(EPOCH FROM (NOW() - ub.fecha_registro)) / 60)::int AS minutos_desde,
              COALESCE(ca.contactos, '[]'::json) AS contactos_autorizados
         FROM usuarios u
         JOIN ubicaciones ub ON ub.id_usuario = u.id_usuario
    LEFT JOIN perfiles p ON p.id_usuario = u.id_usuario
    LEFT JOIN LATERAL (
           SELECT json_agg(json_build_object(
                    'nombre', c.nombre, 'parentesco', c.parentesco,
                    'telefono', c.telefono, 'correo', c.correo)
                  ORDER BY c.prioridad) AS contactos
             FROM contactos_confianza c
            WHERE c.id_usuario = u.id_usuario
              AND c.autorizado_ubicacion = TRUE
              AND c.estado = 'ACTIVO'
              AND c.telefono IS NOT NULL
         ) ca ON TRUE
        WHERE ($1::bigint IS NULL OR u.id_institucion = $1::bigint)
          AND ub.fecha_registro >= NOW() - ($2::int || ' minutes')::interval
        ORDER BY u.id_usuario, ub.fecha_registro DESC`,
      [idInstitucion, ventana],
    );

    return filas.map((f: any) => ({
      id_usuario: f.id_usuario,
      nombre: f.nombre,
      correo: f.correo,
      rol: f.rol,
      telefono: f.telefono_usuario ?? null,
      latitud: f.latitud,
      longitud: f.longitud,
      precision_metros: f.precision_metros,
      fecha_registro: new Date(f.fecha_registro).toISOString(),
      minutos_desde: f.minutos_desde,
      contactos_autorizados: f.contactos_autorizados ?? [],
    }));
  }

  /**
   * GET /ayuda/ubicaciones/usuario/:id — ruta reciente (últimos
   * pings) + resumen de contactos. Dueño, ADMIN o la institución
   * del usuario.
   */
  async ruta(
    idUsuarioObjetivo: number,
    usuario: Usuario,
    limit?: number,
  ): Promise<{
    usuario: { id_usuario: number; nombre: string; telefono: string | null };
    contactos_autorizados: ContactoUbicable[];
    puntos: {
      id_ubicacion: number;
      latitud: number;
      longitud: number;
      precision_metros: number | null;
      fecha_registro: string;
    }[];
  }> {
    const tope = Math.min(Math.max(limit ?? TRAIL_DEFECTO, 1), TRAIL_MAX);

    const objetivo = await this.dataSource.query(
      `SELECT u.id_usuario::int AS id_usuario,
              COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), u.correo) AS nombre,
              u.id_institucion, p.telefono AS telefono_usuario
         FROM usuarios u
    LEFT JOIN perfiles p ON p.id_usuario = u.id_usuario
        WHERE u.id_usuario = $1`,
      [idUsuarioObjetivo],
    );

    if (objetivo.length === 0) {
      throw new NotFoundException(
        `Usuario con id ${idUsuarioObjetivo} no encontrado.`,
      );
    }
    const info = objetivo[0];

    // ─── Permisos (dueño | ADMIN | institución del objetivo) ───
    const esDueno = usuario.id_usuario === info.id_usuario;
    const esAdmin = usuario.rol === 'ADMIN';
    const esInstitucion =
      usuario.rol === 'INSTITUCION' &&
      usuario.id_institucion != null &&
      usuario.id_institucion === info.id_institucion;
    if (!esDueno && !esAdmin && !esInstitucion) {
      throw new NotFoundException(
        'No tienes acceso a la ubicación de este usuario.',
      ); // 404: no revela existencia (mismo criterio que navegación)
    }

    const puntos = await this.dataSource.query(
      `SELECT id_ubicacion::int AS id_ubicacion,
              latitud::float8 AS latitud,
              longitud::float8 AS longitud,
              precision_metros::float8 AS precision_metros,
              fecha_registro
         FROM ubicaciones
        WHERE id_usuario = $1
        ORDER BY fecha_registro DESC
        LIMIT $2`,
      [idUsuarioObjetivo, tope],
    );

    const contactos = await this.dataSource.query(
      `SELECT nombre, parentesco, telefono, correo
         FROM contactos_confianza
        WHERE id_usuario = $1
          AND autorizado_ubicacion = TRUE
          AND estado = 'ACTIVO'
          AND telefono IS NOT NULL
        ORDER BY prioridad`,
      [idUsuarioObjetivo],
    );

    return {
      usuario: {
        id_usuario: info.id_usuario,
        nombre: info.nombre,
        telefono: info.telefono_usuario ?? null,
      },
      contactos_autorizados: contactos,
      puntos: puntos.map((p: any) => ({
        id_ubicacion: p.id_ubicacion,
        latitud: p.latitud,
        longitud: p.longitud,
        precision_metros: p.precision_metros,
        fecha_registro: new Date(p.fecha_registro).toISOString(),
      })),
    };
  }
}
