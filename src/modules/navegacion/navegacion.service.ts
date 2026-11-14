import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  construirRespuestaPaginada,
  RespuestaPaginada,
} from '../../common/dto/pagination.dto';
import { HistorialService } from '../historial/historial.service';
import { TIPOS_ACTIVIDAD } from '../historial/entities/historial-actividad.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  EstadoNavegacion,
  Navegacion,
} from './entities/navegacion.entity';
import { PuntoNavegacion } from './entities/punto-navegacion.entity';
import {
  AgregarPuntoDto,
  CrearNavegacionDto,
  FinalizarNavegacionDto,
  NavegacionQueryDto,
  NavegacionResponseDto,
  PuntoResponseDto,
} from './dto';

/** Radio terrestre en metros (para Haversine) */
const RADIO_TIERRA_M = 6371000;

/**
 * ══════════════════════════════════════════════════════
 * Servicio de navegación asistida (CU24).
 *
 * iniciar():     crea la sesión (INICIADA) con origen/destino.
 * agregarPunto(): suma un punto GPS a la traza; INICIADA pasa
 *                 a EN_CURSO; `orden` auto = MAX(orden)+1.
 * finalizar():   COMPLETADA/CANCELADA/ERROR + fecha_fin.
 * listar():      mis navegaciones (sin traza — liviano).
 * obtenerPorId(): detalle con traza ordenada + distancia
 *                 (Haversine) + duración.
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class NavegacionService {
  private readonly logger = new Logger(NavegacionService.name);

  constructor(
    @InjectRepository(Navegacion)
    private readonly navegacionesRepo: Repository<Navegacion>,
    @InjectRepository(PuntoNavegacion)
    private readonly puntosRepo: Repository<PuntoNavegacion>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly historialService: HistorialService,
  ) {}

  // ═══════════════════ INICIAR (CU24) ═══════════════════

  async iniciar(
    idUsuario: number,
    dto: CrearNavegacionDto,
  ): Promise<NavegacionResponseDto> {
    const navegacion = await this.navegacionesRepo.save(
      this.navegacionesRepo.create({
        id_usuario: idUsuario,
        origen_latitud: dto.origen_latitud ?? null,
        origen_longitud: dto.origen_longitud ?? null,
        destino_latitud: dto.destino_latitud ?? null,
        destino_longitud: dto.destino_longitud ?? null,
        destino_descripcion: dto.destino_descripcion ?? null,
        modo: dto.modo ?? 'ASISTIDA',
        estado: 'INICIADA',
      }),
    );
    const idNavegacion = Number(navegacion.id_navegacion);

    await this.historialService.registrar(
      idUsuario,
      TIPOS_ACTIVIDAD.NAVEGACION_INICIADA,
      idNavegacion,
      `Navegación ${dto.modo ?? 'ASISTIDA'} iniciada` +
        (dto.destino_descripcion ? ` hacia ${dto.destino_descripcion}.` : '.'),
    );

    this.logger.log(`🧭 Navegación ${idNavegacion} iniciada (usuario ${idUsuario}).`);

    return this.armarRespuesta(
      await this.obtenerEntidadCompleta(idNavegacion, idUsuario),
      'Navegación iniciada' +
        (dto.destino_descripcion ? ` hacia ${dto.destino_descripcion}.` : '.'),
    );
  }

  // ═══════════════════ PUNTOS ═══════════════════

  /** Agrega un punto GPS a la traza (la navegación pasa a EN_CURSO). */
  async agregarPunto(
    idNavegacion: number,
    dto: AgregarPuntoDto,
    idUsuario: number,
  ): Promise<NavegacionResponseDto> {
    const navegacion = await this.obtenerEntidadCompleta(idNavegacion, idUsuario);

    if (
      navegacion.estado !== 'INICIADA' &&
      navegacion.estado !== 'EN_CURSO'
    ) {
      throw new BadRequestException(
        `La navegación ${idNavegacion} ya está ${navegacion.estado.toLowerCase()}; ` +
          'no acepta más puntos.',
      );
    }

    // Orden: el enviado o el siguiente disponible (MAX + 1)
    let orden = dto.orden;
    if (orden === undefined) {
      const maximo = await this.puntosRepo
        .createQueryBuilder('punto')
        .where('punto.id_navegacion = :idNavegacion', { idNavegacion })
        .select('COALESCE(MAX(punto.orden), 0)', 'maximo')
        .getRawOne<{ maximo: string | number }>();
      orden = Number(maximo?.maximo ?? 0) + 1;
    } else {
      const existe = await this.puntosRepo.exist({
        where: { id_navegacion: idNavegacion, orden },
      });
      if (existe) {
        throw new BadRequestException(
          `Ya existe un punto con orden ${orden} en la navegación ${idNavegacion}.`,
        );
      }
    }

    await this.puntosRepo.insert({
      id_navegacion: idNavegacion,
      orden,
      latitud: dto.latitud,
      longitud: dto.longitud,
      instruccion: dto.instruccion ?? null,
      referencia_entorno: dto.referencia_entorno ?? null,
    });

    // INICIADA → EN_CURSO con el primer punto registrado
    if (navegacion.estado === 'INICIADA') {
      await this.navegacionesRepo.update(idNavegacion, {
        estado: 'EN_CURSO' as EstadoNavegacion,
      });
    }

    return this.armarRespuesta(
      await this.obtenerEntidadCompleta(idNavegacion, idUsuario),
      `Punto ${orden} registrado. Llevas ${orden} ${orden === 1 ? 'punto' : 'puntos'} en la ruta.`,
    );
  }

  // ═══════════════════ FINALIZAR ═══════════════════

  async finalizar(
    idNavegacion: number,
    dto: FinalizarNavegacionDto,
    idUsuario: number,
  ): Promise<NavegacionResponseDto> {
    const navegacion = await this.obtenerEntidadCompleta(idNavegacion, idUsuario);

    if (navegacion.fecha_fin) {
      throw new BadRequestException(
        `La navegación ${idNavegacion} ya finalizó (${navegacion.estado.toLowerCase()}).`,
      );
    }

    await this.navegacionesRepo.update(idNavegacion, {
      estado: dto.estado_final as EstadoNavegacion,
      fecha_fin: new Date(),
    });

    await this.historialService.registrar(
      idUsuario,
      TIPOS_ACTIVIDAD.NAVEGACION_FINALIZADA,
      idNavegacion,
      `Navegación ${dto.estado_final.toLowerCase()}.`,
    );

    this.logger.log(
      `🧭 Navegación ${idNavegacion} → ${dto.estado_final} (usuario ${idUsuario}).`,
    );

    const finalizada = await this.obtenerEntidadCompleta(idNavegacion, idUsuario);
    const distancia = this.calcularDistancia(finalizada.puntos ?? []);

    const mensajeVoz =
      dto.estado_final === 'COMPLETADA'
        ? `Navegación completada. Recorriste ${Math.round(distancia)} metros.`
        : `Navegación ${dto.estado_final === 'CANCELADA' ? 'cancelada' : 'terminada con error'}.`;

    return this.armarRespuesta(finalizada, mensajeVoz);
  }

  // ═══════════════════ CONSULTAS ═══════════════════

  /** Mis navegaciones (paginado, reciente primero — sin traza) */
  async listar(
    idUsuario: number,
    query: NavegacionQueryDto,
  ): Promise<RespuestaPaginada<NavegacionResponseDto>> {
    const qb = this.navegacionesRepo
      .createQueryBuilder('navegacion')
      .where('navegacion.id_usuario = :idUsuario', { idUsuario })
      .orderBy('navegacion.fecha_inicio', 'DESC')
      .skip(query.skip)
      .take(query.take);

    if (query.estado) {
      qb.andWhere('navegacion.estado = :estado', { estado: query.estado });
    }
    if (query.buscar) {
      qb.andWhere('navegacion.destino_descripcion ILIKE :buscar', {
        buscar: `%${query.buscar}%`,
      });
    }

    const [navegaciones, total] = await qb.getManyAndCount();

    return construirRespuestaPaginada(
      navegaciones.map((n) => this.armarRespuesta(n, null)),
      total,
      query,
    );
  }

  /** Detalle con traza ordenada + métricas */
  async obtenerPorId(
    idNavegacion: number,
    idUsuario: number,
  ): Promise<NavegacionResponseDto> {
    const navegacion = await this.obtenerEntidadCompleta(
      idNavegacion,
      idUsuario,
    );
    return this.armarRespuesta(navegacion, null);
  }

  // ═══════════════════ HELPERS ═══════════════════

  /** Carga la navegación propia con la traza ordenada (404 si ajena) */
  private async obtenerEntidadCompleta(
    idNavegacion: number,
    idUsuario: number,
  ): Promise<Navegacion> {
    const navegacion = await this.navegacionesRepo.findOne({
      where: { id_navegacion: idNavegacion },
      relations: { puntos: true },
    });

    // 404 si no existe o es de otro usuario (no filtra existencia)
    if (
      !navegacion ||
      Number(navegacion.id_usuario) !== Number(idUsuario)
    ) {
      throw new NotFoundException(
        `Navegación con id ${idNavegacion} no encontrada.`,
      );
    }

    navegacion.puntos = (navegacion.puntos ?? []).sort(
      (a, b) => a.orden - b.orden,
    );
    return navegacion;
  }

  /** Distancia total de la traza (Haversine punto a punto) */
  private calcularDistancia(puntos: PuntoNavegacion[]): number {
    let total = 0;
    for (let i = 1; i < puntos.length; i++) {
      total += this.haversine(
        Number(puntos[i - 1].latitud),
        Number(puntos[i - 1].longitud),
        Number(puntos[i].latitud),
        Number(puntos[i].longitud),
      );
    }
    return Math.round(total * 10) / 10;
  }

  /** Distancia entre dos coordenadas en metros */
  private haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return RADIO_TIERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Entidad (con o sin traza) → DTO público */
  private armarRespuesta(
    navegacion: Navegacion,
    mensajeVoz: string | null,
  ): NavegacionResponseDto {
    const conTraza = navegacion.puntos !== undefined;

    return {
      id_navegacion: Number(navegacion.id_navegacion),
      id_usuario: Number(navegacion.id_usuario),
      origen_latitud:
        navegacion.origen_latitud !== null
          ? Number(navegacion.origen_latitud)
          : null,
      origen_longitud:
        navegacion.origen_longitud !== null
          ? Number(navegacion.origen_longitud)
          : null,
      destino_latitud:
        navegacion.destino_latitud !== null
          ? Number(navegacion.destino_latitud)
          : null,
      destino_longitud:
        navegacion.destino_longitud !== null
          ? Number(navegacion.destino_longitud)
          : null,
      destino_descripcion: navegacion.destino_descripcion,
      modo: navegacion.modo,
      estado: navegacion.estado,
      fecha_inicio: navegacion.fecha_inicio,
      fecha_fin: navegacion.fecha_fin,
      ...(conTraza
        ? {
            puntos: navegacion.puntos.map(
              (p): PuntoResponseDto => ({
                id_punto: Number(p.id_punto),
                orden: p.orden,
                latitud: Number(p.latitud),
                longitud: Number(p.longitud),
                instruccion: p.instruccion,
                referencia_entorno: p.referencia_entorno,
              }),
            ),
            distancia_metros: this.calcularDistancia(navegacion.puntos ?? []),
            duracion_segundos: navegacion.fecha_fin
              ? Math.max(
                  0,
                  Math.round(
                    (navegacion.fecha_fin.getTime() -
                      navegacion.fecha_inicio.getTime()) /
                      1000,
                  ),
                )
              : null,
          }
        : {}),
      mensaje_voz: mensajeVoz,
    };
  }
}
