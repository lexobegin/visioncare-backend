import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import {
  construirRespuestaPaginada,
  RespuestaPaginada,
} from '../../common/dto/pagination.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Navegacion } from '../navegacion/entities/navegacion.entity';
import { PuntoNavegacion } from '../navegacion/entities/punto-navegacion.entity';
import { Sincronizacion } from './entities/sincronizacion.entity';
import {
  BajarSincronizacionDto,
  BajarResultadoDto,
  CambioResultadoDto,
  EntidadSync,
  HistorialOfflineDto,
  NavegacionOfflineDto,
  SincronizacionQueryDto,
  SincronizacionResponseDto,
  SubirResultadoDto,
  SubirSincronizacionDto,
  SincronizarCambioDto,
} from './dto';

const DIAS_BAJADA_DEFAULT = 7;
const MAX_PUNTOS_POR_NAVEGACION = 2000;
const MAX_ACTIVIDADES_BAJADA = 300;

/**
 * ══════════════════════════════════════════════════════
 * Servicio de sincronización offline (CU25 subida, CU26 bajada).
 *
 * subir(): procesa un lote de cambios offline CAMBIO POR CAMBIO:
 *   - idempotente: si (usuario, dispositivo, identificador_local)
 *     ya se sincronizó → OMITIDO_DUPLICADO con el ID de servidor.
 *   - un error en un cambio NO aborta el lote (estado ERROR).
 *   - dentro del lote, PUNTO_NAVEGACION puede referenciar una
 *     NAVEGACION anterior por su ID local (mapa local→servidor).
 *   - cada cambio queda en la bitácora `sincronizaciones`.
 * bajar(): navegaciones (+puntos) y actividades del historial
 *   desde la última fecha de sincronización (o últimos 7 días).
 * listar(): bitácora propia paginada.
 *
 * Nota: el tipo 'SINCRONIZACION_REALIZADA' se agrega a
 * TIPOS_ACTIVIDAD (README, paso 3).
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class SincronizacionService {
  private readonly logger = new Logger(SincronizacionService.name);

  constructor(
    @InjectRepository(Sincronizacion)
    private readonly sincronizacionesRepo: Repository<Sincronizacion>,
    @InjectRepository(Navegacion)
    private readonly navegacionesRepo: Repository<Navegacion>,
    @InjectRepository(PuntoNavegacion)
    private readonly puntosRepo: Repository<PuntoNavegacion>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
  ) {}

  // ═══════════════════ CU25 — SUBIDA ═══════════════════

  async subir(
    idUsuario: number,
    dto: SubirSincronizacionDto,
  ): Promise<SubirResultadoDto> {
    // El usuario debe existir (FK temprana, mensaje claro)
    const usuarioExiste = await this.usuariosRepo.exist({
      where: { id_usuario: idUsuario },
    });
    if (!usuarioExiste) {
      throw new NotFoundException(
        `Usuario con id ${idUsuario} no encontrado.`,
      );
    }

    // Mapa de IDs locales → IDs de servidor (dentro de este lote)
    const mapaLocalServidor = new Map<string, number>();

    const resultados: CambioResultadoDto[] = [];
    let sincronizados = 0;
    let omitidos = 0;
    let errores = 0;
    let primerServerId: number | null = null;

    for (const cambio of dto.cambios) {
      const base: CambioResultadoDto = {
        identificador_local: cambio.identificador_local,
        entidad: cambio.entidad,
        estado: 'SINCRONIZADO',
        identificador_servidor: null,
        mensaje: null,
      };

      try {
        // ── Idempotencia: ¿ya subimos este cambio desde este dispositivo? ──
        const previo = await this.sincronizacionesRepo.findOne({
          where: {
            id_usuario: idUsuario,
            dispositivo_id: dto.dispositivo_id,
            identificador_local: cambio.identificador_local,
            estado: 'SINCRONIZADO',
          },
          order: { fecha_sincronizacion: 'DESC' },
        });

        if (previo) {
          omitidos += 1;
          resultados.push({
            ...base,
            estado: 'OMITIDO_DUPLICADO',
            identificador_servidor: previo.identificador_servidor
              ? Number(previo.identificador_servidor)
              : null,
            mensaje: 'Ya se había sincronizado este cambio antes.',
          });
          continue;
        }

        // ── Procesar según entidad ──
        const serverId = await this.procesarCambio(
          idUsuario,
          cambio,
          mapaLocalServidor,
        );
        if (primerServerId === null && serverId !== null) {
          primerServerId = serverId;
        }

        // ── Bitácora del cambio ──
        await this.sincronizacionesRepo.save(
          this.sincronizacionesRepo.create({
            id_usuario: idUsuario,
            dispositivo_id: dto.dispositivo_id,
            direccion: 'SUBIDA',
            entidad: cambio.entidad,
            identificador_local: cambio.identificador_local,
            identificador_servidor: serverId,
            version_local: cambio.version_local ?? null,
            version_servidor: null,
            conflicto_detectado: false,
            resolucion_conflicto: null,
            estado: 'SINCRONIZADO',
          }),
        );

        sincronizados += 1;
        resultados.push({
          ...base,
          identificador_servidor: serverId,
        });
      } catch (error) {
        // Error de ESTE cambio: registrar y continuar con el lote
        const mensaje =
          error instanceof Error
            ? error.message
            : 'Error desconocido al sincronizar el cambio.';
        this.logger.warn(
          `⚠️ Cambio offline ${cambio.identificador_local} (${cambio.entidad}) rechazado: ${mensaje}`,
        );

        await this.sincronizacionesRepo.save(
          this.sincronizacionesRepo.create({
            id_usuario: idUsuario,
            dispositivo_id: dto.dispositivo_id,
            direccion: 'SUBIDA',
            entidad: cambio.entidad,
            identificador_local: cambio.identificador_local,
            identificador_servidor: null,
            version_local: cambio.version_local ?? null,
            conflicto_detectado: false,
            estado: 'ERROR',
          }),
        );

        errores += 1;
        resultados.push({ ...base, estado: 'ERROR', mensaje });
      }
    }

    // ── Una sola actividad por lote (sincronización completa) ──
    if (sincronizados > 0) {
      await this.registrarActividad(
        idUsuario,
        `Sincronizó ${sincronizados} cambio(s) desde el dispositivo ${dto.dispositivo_id}.`,
      );
    }

    this.logger.log(
      `🔄 Subida offline usuario ${idUsuario}: ${sincronizados} OK, ` +
        `${omitidos} duplicados, ${errores} errores (dispositivo ${dto.dispositivo_id}).`,
    );

    return {
      dispositivo_id: dto.dispositivo_id,
      total: dto.cambios.length,
      sincronizados,
      omitidos_duplicados: omitidos,
      errores,
      resultados,
    };
  }

  // ═══════════════════ CU26 — BAJADA ═══════════════════

  async bajar(
    idUsuario: number,
    dto: BajarSincronizacionDto,
  ): Promise<BajarResultadoDto> {
    const desde = dto.ultima_fecha_sincronizacion
      ? new Date(dto.ultima_fecha_sincronizacion)
      : new Date(Date.now() - DIAS_BAJADA_DEFAULT * 24 * 60 * 60 * 1000);

    // ── Navegaciones propias con su traza (para la cache offline) ──
    const navegaciones = await this.navegacionesRepo.find({
      where: {
        id_usuario: idUsuario,
        fecha_inicio: MoreThanOrEqual(desde),
      },
      relations: { puntos: true },
      order: { fecha_inicio: 'DESC' },
      take: 100,
    });

    // ── Actividades propias del historial (consulta liviana) ──
    const historialRaw = (await this.sincronizacionesRepo.query(
      `SELECT id_historial, tipo_actividad, referencia_id, descripcion, fecha_actividad
         FROM historial_actividades
        WHERE id_usuario = $1 AND fecha_actividad >= $2
        ORDER BY fecha_actividad DESC
        LIMIT $3`,
      [idUsuario, desde, MAX_ACTIVIDADES_BAJADA],
    )) as Array<{
      id_historial: string | number;
      tipo_actividad: string;
      referencia_id: string | number | null;
      descripcion: string | null;
      fecha_actividad: Date;
    }>;

    const historial: HistorialOfflineDto[] = historialRaw.map((h) => ({
      id_historial: Number(h.id_historial),
      tipo_actividad: h.tipo_actividad,
      referencia_id: h.referencia_id !== null ? Number(h.referencia_id) : null,
      descripcion: h.descripcion,
      fecha_actividad: new Date(h.fecha_actividad),
    }));

    // ── Bitácora de la descarga ──
    await this.sincronizacionesRepo.save(
      this.sincronizacionesRepo.create({
        id_usuario: idUsuario,
        dispositivo_id: dto.dispositivo_id,
        direccion: 'BAJADA',
        entidad: null,
        identificador_local: null,
        identificador_servidor: null,
        conflicto_detectado: false,
        estado: 'SINCRONIZADO',
      }),
    );

    this.logger.log(
      `🔄 Bajada offline usuario ${idUsuario}: ${navegaciones.length} navegaciones, ` +
        `${historial.length} actividades (desde ${desde.toISOString()}).`,
    );

    return {
      fecha_servidor: new Date(),
      desde,
      navegaciones: navegaciones.map((n) => this.armarNavegacion(n)),
      historial,
    };
  }

  // ═══════════════════ BITÁCORA ═══════════════════

  async listar(
    idUsuario: number,
    query: SincronizacionQueryDto,
  ): Promise<RespuestaPaginada<SincronizacionResponseDto>> {
    const qb = this.sincronizacionesRepo
      .createQueryBuilder('sync')
      .where('sync.id_usuario = :idUsuario', { idUsuario })
      .orderBy('sync.fecha_sincronizacion', 'DESC')
      .skip(query.skip)
      .take(query.take);

    if (query.estado) {
      qb.andWhere('sync.estado = :estado', { estado: query.estado });
    }
    if (query.dispositivo_id) {
      qb.andWhere('sync.dispositivo_id = :dispositivo', {
        dispositivo: query.dispositivo_id,
      });
    }

    const [filas, total] = await qb.getManyAndCount();
    return construirRespuestaPaginada(
      filas.map((f) => this.armarSyncRow(f)),
      total,
      query,
    );
  }

  // ═══════════════════ PROCESADORES POR ENTIDAD ═══════════════════

  /** Crea la navegación (+puntos) del payload offline. Devuelve el ID de servidor. */
  private async procesarNavegacion(
    idUsuario: number,
    cambio: SincronizarCambioDto,
    mapaLocalServidor: Map<string, number>,
  ): Promise<number> {
    const p = cambio.payload;

    const modo = this.validarEnum(
      p.modo,
      ['ASISTIDA', 'VOZ', 'MAPA'] as const,
      'modo',
    );
    const estado = this.validarEnum(
      p.estado,
      ['INICIADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'ERROR'] as const,
      'estado',
    );

    if (p.destino_descripcion !== undefined && p.destino_descripcion !== null) {
      this.validarTexto(p.destino_descripcion, 'destino_descripcion', 255);
    }
    if (p.fecha_inicio !== undefined && p.fecha_inicio !== null) {
      this.validarFecha(p.fecha_inicio, 'fecha_inicio');
    }
    if (p.fecha_fin !== undefined && p.fecha_fin !== null) {
      this.validarFecha(p.fecha_fin, 'fecha_fin');
    }

    const navegacion = await this.navegacionesRepo.save(
      this.navegacionesRepo.create({
        id_usuario: idUsuario,
        origen_latitud: this.validarCoord(p.origen_latitud, -90, 90, 'origen_latitud'),
        origen_longitud: this.validarCoord(p.origen_longitud, -180, 180, 'origen_longitud'),
        destino_latitud: this.validarCoord(p.destino_latitud, -90, 90, 'destino_latitud'),
        destino_longitud: this.validarCoord(p.destino_longitud, -180, 180, 'destino_longitud'),
        destino_descripcion: (p.destino_descripcion as string) ?? null,
        modo: modo ?? 'ASISTIDA',
        estado: estado ?? 'INICIADA',
        fecha_inicio: p.fecha_inicio ? new Date(p.fecha_inicio as string) : new Date(),
        fecha_fin: p.fecha_fin ? new Date(p.fecha_fin as string) : null,
      }),
    );
    const idNavegacion = Number(navegacion.id_navegacion);

    // Puntos offline de la navegación (orden del arreglo o `orden` enviado)
    const puntos = Array.isArray(p.puntos) ? p.puntos : [];
    if (puntos.length > MAX_PUNTOS_POR_NAVEGACION) {
      throw new BadRequestException(
        `puntos no puede superar ${MAX_PUNTOS_POR_NAVEGACION} por navegación.`,
      );
    }

    const usados = new Set<number>();
    for (let i = 0; i < puntos.length; i++) {
      const punto = puntos[i] as Record<string, unknown>;
      const latitud = this.validarCoord(punto.latitud, -90, 90, `puntos[${i}].latitud`);
      const longitud = this.validarCoord(punto.longitud, -180, 180, `puntos[${i}].longitud`);
      if (latitud === null || longitud === null) {
        throw new BadRequestException(
          `puntos[${i}]: latitud y longitud son obligatorios.`,
        );
      }
      this.validarTexto(punto.instruccion, `puntos[${i}].instruccion`, 1000);
      this.validarTexto(
        punto.referencia_entorno,
        `puntos[${i}].referencia_entorno`,
        1000,
      );

      let orden = i + 1;
      if (punto.orden !== undefined && punto.orden !== null) {
        orden = Number(punto.orden);
        if (!Number.isInteger(orden) || orden < 1) {
          throw new BadRequestException(
            `puntos[${i}].orden debe ser un entero >= 1.`,
          );
        }
        if (usados.has(orden)) {
          throw new BadRequestException(
            `puntos[${i}].orden ${orden} está duplicado.`,
          );
        }
      }
      usados.add(orden);

      await this.puntosRepo.insert({
        id_navegacion: idNavegacion,
        orden,
        latitud,
        longitud,
        instruccion: (punto.instruccion as string) ?? null,
        referencia_entorno: (punto.referencia_entorno as string) ?? null,
      });
    }

    // Referenciable dentro del lote por su ID local
    mapaLocalServidor.set(
      `NAVEGACION:${cambio.identificador_local}`,
      idNavegacion,
    );
    return idNavegacion;
  }

  /** Agrega un punto a una navegación (por ID servidor o ID local del lote). */
  private async procesarPunto(
    idUsuario: number,
    cambio: SincronizarCambioDto,
    mapaLocalServidor: Map<string, number>,
  ): Promise<number> {
    const p = cambio.payload;

    let idNavegacion: number | null = null;
    if (p.id_navegacion !== undefined && p.id_navegacion !== null) {
      idNavegacion = Number(p.id_navegacion);
    } else if (p.id_navegacion_local !== undefined && p.id_navegacion_local !== null) {
      idNavegacion =
        mapaLocalServidor.get(`NAVEGACION:${String(p.id_navegacion_local)}`) ??
        null;
      if (idNavegacion === null) {
        throw new BadRequestException(
          'id_navegacion_local no corresponde a ninguna navegación creada ' +
            'en este mismo lote; súbelas en el mismo request (NAVEGACION antes de PUNTO_NAVEGACION).',
        );
      }
    } else {
      throw new BadRequestException(
        'El payload de PUNTO_NAVEGACION requiere id_navegacion (servidor) ' +
          'o id_navegacion_local (dentro del lote).',
      );
    }

    // La navegación debe existir y ser del usuario (no filtra existencia ajena)
    const navegacion = await this.navegacionesRepo.findOne({
      where: { id_navegacion: idNavegacion },
    });
    if (!navegacion || Number(navegacion.id_usuario) !== Number(idUsuario)) {
      throw new NotFoundException(
        `Navegación con id ${idNavegacion} no encontrada.`,
      );
    }

    const latitud = this.validarCoord(p.latitud, -90, 90, 'latitud');
    const longitud = this.validarCoord(p.longitud, -180, 180, 'longitud');
    if (latitud === null || longitud === null) {
      throw new BadRequestException('latitud y longitud son obligatorios.');
    }
    this.validarTexto(p.instruccion, 'instruccion', 1000);
    this.validarTexto(p.referencia_entorno, 'referencia_entorno', 1000);

    // Orden: el enviado (sin duplicados) o el siguiente disponible
    let orden: number;
    if (p.orden !== undefined && p.orden !== null) {
      orden = Number(p.orden);
      if (!Number.isInteger(orden) || orden < 1) {
        throw new BadRequestException('orden debe ser un entero >= 1.');
      }
      const existe = await this.puntosRepo.exist({
        where: { id_navegacion: idNavegacion, orden },
      });
      if (existe) {
        throw new BadRequestException(
          `Ya existe un punto con orden ${orden} en la navegación ${idNavegacion}.`,
        );
      }
    } else {
      const maximo = await this.puntosRepo
        .createQueryBuilder('punto')
        .where('punto.id_navegacion = :idNavegacion', { idNavegacion })
        .select('COALESCE(MAX(punto.orden), 0)', 'maximo')
        .getRawOne<{ maximo: string | number }>();
      orden = Number(maximo?.maximo ?? 0) + 1;
    }

    await this.puntosRepo.insert({
      id_navegacion: idNavegacion,
      orden,
      latitud,
      longitud,
      instruccion: (p.instruccion as string) ?? null,
      referencia_entorno: (p.referencia_entorno as string) ?? null,
    });

    // Referenciable dentro del lote por su ID local
    mapaLocalServidor.set(
      `PUNTO_NAVEGACION:${cambio.identificador_local}`,
      orden,
    );
    return idNavegacion;
  }

  /** Registra una actividad offline en el historial. */
  private async procesarHistorial(
    idUsuario: number,
    cambio: SincronizarCambioDto,
  ): Promise<number> {
    const p = cambio.payload;

    const tipo = p.tipo_actividad;
    if (typeof tipo !== 'string' || tipo.length === 0 || tipo.length > 50) {
      throw new BadRequestException(
        'tipo_actividad es obligatorio (texto de 1 a 50 caracteres).',
      );
    }
    this.validarTexto(p.descripcion, 'descripcion', 500);
    if (p.fecha_actividad !== undefined && p.fecha_actividad !== null) {
      this.validarFecha(p.fecha_actividad, 'fecha_actividad');
    }
    if (p.referencia_id !== undefined && p.referencia_id !== null) {
      const ref = Number(p.referencia_id);
      if (!Number.isInteger(ref) || ref < 1) {
        throw new BadRequestException('referencia_id debe ser un entero >= 1.');
      }
    }

    const filas = (await this.sincronizacionesRepo.query(
      `INSERT INTO historial_actividades
         (id_usuario, tipo_actividad, referencia_id, descripcion, fecha_actividad)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, CURRENT_TIMESTAMP))
       RETURNING id_historial`,
      [
        idUsuario,
        tipo,
        p.referencia_id != null ? Number(p.referencia_id) : null,
        (p.descripcion as string) ?? null,
        p.fecha_actividad ? String(p.fecha_actividad) : null,
      ],
    )) as Array<{ id_historial: string | number }>;

    return Number(filas[0].id_historial);
  }

  /** Despacha el cambio según la entidad declarada */
  private async procesarCambio(
    idUsuario: number,
    cambio: SincronizarCambioDto,
    mapaLocalServidor: Map<string, number>,
  ): Promise<number | null> {
    switch (cambio.entidad as EntidadSync) {
      case 'NAVEGACION':
        return this.procesarNavegacion(idUsuario, cambio, mapaLocalServidor);
      case 'PUNTO_NAVEGACION':
        return this.procesarPunto(idUsuario, cambio, mapaLocalServidor);
      case 'HISTORIAL_ACTIVIDAD':
        return this.procesarHistorial(idUsuario, cambio);
      default:
        throw new BadRequestException(
          `Entidad no soportada: ${cambio.entidad}.`,
        );
    }
  }

  /** Inserta una actividad del lote en el historial (sin depender del service) */
  private async registrarActividad(
    idUsuario: number,
    descripcion: string,
  ): Promise<void> {
    try {
      await this.sincronizacionesRepo.query(
        `INSERT INTO historial_actividades (id_usuario, tipo_actividad, descripcion)
         VALUES ($1, $2, $3)`,
        [idUsuario, 'SINCRONIZACION_REALIZADA', descripcion],
      );
    } catch (error) {
      // El lote ya se aplicó; el historial no debe romper la respuesta
      this.logger.warn(`No se pudo registrar actividad de sync: ${error}`);
    }
  }

  // ═══════════════════ VALIDADORES DE PAYLOAD ═══════════════════

   /**
   * Enum opcional; valor fuera de lista → error del cambio.
   * Genérico: devuelve la MISMA unión que declara la entidad
   * (ModoNavegacion/EstadoNavegacion), no `string`, para que
   * repo.create() tipifique sin casts.
   */
  private validarEnum<T extends string>(
    valor: unknown,
    permitidos: readonly T[],
    campo: string,
  ): T | null {
    if (valor === undefined || valor === null) return null;
    if (!permitidos.includes(valor as T)) {
      throw new BadRequestException(
        `${campo} debe ser uno de: ${permitidos.join(', ')}.`,
      );
    }
    return valor as T;
  }

  /** Coordenada opcional; fuera de rango → error del cambio */
  private validarCoord(
    valor: unknown,
    min: number,
    max: number,
    campo: string,
  ): number | null {
    if (valor === undefined || valor === null || valor === '') return null;
    const n = Number(valor);
    if (Number.isNaN(n) || n < min || n > max) {
      throw new BadRequestException(
        `${campo} debe ser un número entre ${min} y ${max}.`,
      );
    }
    return n;
  }

  /** Texto opcional con tope de longitud */
  private validarTexto(valor: unknown, campo: string, max: number): void {
    if (valor === undefined || valor === null) return;
    if (typeof valor !== 'string') {
      throw new BadRequestException(`${campo} debe ser texto.`);
    }
    if (valor.length > max) {
      throw new BadRequestException(
        `${campo} no puede superar ${max} caracteres.`,
      );
    }
  }

  /** Fecha ISO parseable */
  private validarFecha(valor: unknown, campo: string): void {
    const fecha = new Date(String(valor));
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException(`${campo} no es una fecha válida.`);
    }
  }

  // ═══════════════════ ARMADO DE RESPUESTAS ═══════════════════

  private armarNavegacion(n: Navegacion): NavegacionOfflineDto {
    return {
      id_navegacion: Number(n.id_navegacion),
      origen_latitud:
        n.origen_latitud !== null ? Number(n.origen_latitud) : null,
      origen_longitud:
        n.origen_longitud !== null ? Number(n.origen_longitud) : null,
      destino_latitud:
        n.destino_latitud !== null ? Number(n.destino_latitud) : null,
      destino_longitud:
        n.destino_longitud !== null ? Number(n.destino_longitud) : null,
      destino_descripcion: n.destino_descripcion,
      modo: n.modo,
      estado: n.estado,
      fecha_inicio: n.fecha_inicio,
      fecha_fin: n.fecha_fin,
      puntos: (n.puntos ?? [])
        .sort((a, b) => a.orden - b.orden)
        .map((p) => ({
          id_punto: Number(p.id_punto),
          orden: p.orden,
          latitud: Number(p.latitud),
          longitud: Number(p.longitud),
          instruccion: p.instruccion,
          referencia_entorno: p.referencia_entorno,
        })),
    };
  }

  private armarSyncRow(s: Sincronizacion): SincronizacionResponseDto {
    return {
      id_sincronizacion: Number(s.id_sincronizacion),
      id_usuario: Number(s.id_usuario),
      dispositivo_id: s.dispositivo_id,
      direccion: s.direccion,
      entidad: s.entidad,
      identificador_local: s.identificador_local,
      identificador_servidor:
        s.identificador_servidor !== null
          ? Number(s.identificador_servidor)
          : null,
      conflicto_detectado: s.conflicto_detectado,
      resolucion_conflicto: s.resolucion_conflicto,
      estado: s.estado,
      fecha_sincronizacion: s.fecha_sincronizacion,
    };
  }
}
