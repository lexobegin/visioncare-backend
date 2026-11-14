import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { HistorialService } from '../historial/historial.service';
import { TIPOS_ACTIVIDAD } from '../historial/entities/historial-actividad.entity';
import { CategoriaVc } from './entities/categoria.entity';
import { EjercicioVc } from './entities/ejercicio.entity';
import { SesionVc } from './entities/sesion.entity';
import { ResultadoVc } from './entities/resultado.entity';
import { ProgresoVc } from './entities/progreso.entity';
import { DesafioVc } from './entities/desafio.entity';
import { InsigniaVc } from './entities/insignia.entity';
import { UsuarioInsigniaVc } from './entities/usuario-insignia.entity';
import {
  ActualizarDesafioDto,
  DesafioResponseDto,
  EjercicioResponseDto,
  EjerciciosQueryDto,
  FinalizarSesionDto,
  InsigniaResponseDto,
  ProgresoResponseDto,
  RegistrarResultadoDto,
  ResultadoRegistradoDto,
  ResultadoResponseDto,
  SesionFinalizadaDto,
  SesionResponseDto,
} from './dto';

/** Cada 100 puntos → +1 nivel */
const PUNTOS_POR_NIVEL = 100;

/** Umbrales de adaptación de dificultad (CU31) */
const UMBRAL_SUBIR = 0.8; // ≥80% aciertos → sube dificultad
const UMBRAL_BAJAR = 0.4; // <40% aciertos → baja dificultad

/** Formato de `condicion` en insignias: "campo >= N" */
const PATRON_CONDICION = /^\s*([a-z_]+)\s*>=\s*(\d+)\s*$/;

/**
 * ══════════════════════════════════════════════════════
 * Servicio de VisionCoach (CU27–CU33).
 *
 *   Catálogo:    listarCategorias / listarEjercicios / obtenerEjercicio
 *   Sesiones:    iniciarSesion (CU28) · registrarResultado (CU29)
 *                · finalizarSesion (CU30)
 *   Progreso:    obtenerProgreso (niveles, rachas, puntos)
 *   Adaptación:  al finalizar COMPLETADA, si ≥80% aciertos asigna
 *                un desafío con dificultad+1; si <40%, con −1 (CU31)
 *   Insignias:   evalúa `condicion` de cada insignia contra el
 *                progreso y otorga las nuevas (CU33)
 *
 * Puntuación server-side: correcto → puntos_base del ejercicio
 * (la app no envía puntos — anti-trampa).
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class VisioncoachService {
  private readonly logger = new Logger(VisioncoachService.name);

  constructor(
    @InjectRepository(CategoriaVc)
    private readonly categoriasRepo: Repository<CategoriaVc>,
    @InjectRepository(EjercicioVc)
    private readonly ejerciciosRepo: Repository<EjercicioVc>,
    @InjectRepository(SesionVc)
    private readonly sesionesRepo: Repository<SesionVc>,
    @InjectRepository(ResultadoVc)
    private readonly resultadosRepo: Repository<ResultadoVc>,
    @InjectRepository(ProgresoVc)
    private readonly progresoRepo: Repository<ProgresoVc>,
    @InjectRepository(DesafioVc)
    private readonly desafiosRepo: Repository<DesafioVc>,
    @InjectRepository(InsigniaVc)
    private readonly insigniasRepo: Repository<InsigniaVc>,
    @InjectRepository(UsuarioInsigniaVc)
    private readonly usuariosInsigniasRepo: Repository<UsuarioInsigniaVc>,
    private readonly historialService: HistorialService,
  ) {}

  // ═══════════════════ CATÁLOGO (CU27) ═══════════════════

  async listarCategorias(): Promise<CategoriaVc[]> {
    return this.categoriasRepo.find({
      where: { estado: 'ACTIVA' },
      order: { nombre: 'ASC' },
    });
  }

  async listarEjercicios(query: EjerciciosQueryDto): Promise<EjercicioResponseDto[]> {
    const qb = this.ejerciciosRepo
      .createQueryBuilder('ejercicio')
      .leftJoinAndSelect('ejercicio.categoria', 'categoria')
      .where('ejercicio.estado = :estado', { estado: 'ACTIVO' })
      .orderBy('ejercicio.dificultad', 'ASC')
      .addOrderBy('ejercicio.nombre', 'ASC');

    if (query.id_categoria) {
      qb.andWhere('ejercicio.id_categoria = :idCategoria', {
        idCategoria: query.id_categoria,
      });
    }
    if (query.dificultad) {
      qb.andWhere('ejercicio.dificultad = :dificultad', {
        dificultad: query.dificultad,
      });
    }

    const ejercicios = await qb.getMany();
    return ejercicios.map((e) => this.armarEjercicio(e));
  }

  async obtenerEjercicio(idEjercicio: number): Promise<EjercicioResponseDto> {
    const ejercicio = await this.ejerciciosRepo.findOne({
      where: { id_ejercicio: idEjercicio, estado: 'ACTIVO' },
      relations: { categoria: true },
    });
    if (!ejercicio) {
      throw new NotFoundException(
        `Ejercicio con id ${idEjercicio} no encontrado.`,
      );
    }
    return this.armarEjercicio(ejercicio);
  }

  // ═══════════════════ SESIONES (CU28–CU30) ═══════════════════

  async iniciarSesion(idUsuario: number): Promise<SesionResponseDto> {
    const sesion = await this.sesionesRepo.save(
      this.sesionesRepo.create({ id_usuario: idUsuario, estado: 'INICIADA' }),
    );

    this.logger.log(
      `🎯 Sesión ${Number(sesion.id_sesion)} iniciada (usuario ${idUsuario}).`,
    );

    return this.armarSesion(
      await this.buscarSesionPropia(Number(sesion.id_sesion), idUsuario),
      'Sesión de entrenamiento iniciada. ¡Éxitos!',
    );
  }

  async registrarResultado(
    idSesion: number,
    dto: RegistrarResultadoDto,
    idUsuario: number,
  ): Promise<ResultadoRegistradoDto> {
    const sesion = await this.buscarSesionPropia(idSesion, idUsuario);

    if (sesion.estado !== 'INICIADA') {
      throw new BadRequestException(
        `La sesión ${idSesion} ya está ${sesion.estado.toLowerCase()}; ` +
          'no acepta más resultados.',
      );
    }

    // Ejercicio activo (si no existe → 404)
    const ejercicio = await this.ejerciciosRepo.findOne({
      where: { id_ejercicio: dto.id_ejercicio, estado: 'ACTIVO' },
    });
    if (!ejercicio) {
      throw new NotFoundException(
        `Ejercicio con id ${dto.id_ejercicio} no encontrado.`,
      );
    }

    // ─── Puntuación server-side (anti-trampa) ───
    const puntuacion = dto.correcto ? ejercicio.puntos_base : 0;

    const resultado = await this.resultadosRepo.save(
      this.resultadosRepo.create({
        id_sesion: idSesion,
        id_ejercicio: Number(ejercicio.id_ejercicio),
        respuesta: dto.respuesta ?? null,
        correcto: dto.correcto,
        puntuacion,
        tiempo_segundos: dto.tiempo_segundos ?? null,
        observaciones: dto.observaciones ?? null,
      }),
    );

    // ─── Puntos de la sesión ───
    await this.sesionesRepo.increment(
      { id_sesion: idSesion },
      'puntos_obtenidos',
      puntuacion,
    );

    // ─── Progreso del usuario (getOrCreate + acumulados) ───
    const progreso = await this.getOrCreateProgreso(idUsuario);
    progreso.puntos_totales += puntuacion;
    if (dto.correcto) {
      progreso.ejercicios_completados += 1;
      progreso.racha_actual += 1;
      progreso.mejor_racha = Math.max(progreso.mejor_racha, progreso.racha_actual);
    } else {
      progreso.racha_actual = 0;
    }
    progreso.nivel = Math.floor(progreso.puntos_totales / PUNTOS_POR_NIVEL) + 1;
    progreso.actualizado_at = new Date();
    await this.progresoRepo.save(progreso);

    if (dto.correcto) {
      await this.historialService.registrar(
        idUsuario,
        TIPOS_ACTIVIDAD.EJERCICIO_COMPLETADO,
        Number(resultado.id_resultado),
        `Completó '${ejercicio.nombre}' (+${puntuacion} puntos).`,
      );
    }

    // ─── Insignias nuevas (CU33) ───
    const insigniasNuevas = await this.evaluarYAsignarInsignias(idUsuario);

    this.logger.log(
      `🎯 Resultado sesión ${idSesion}: ${dto.correcto ? 'CORRECTO' : 'incorrecto'} (+${puntuacion} pts).`,
    );

    const mensajeVoz = dto.correcto
      ? `¡Correcto! +${puntuacion} puntos.` +
        (progreso.racha_actual >= 2
          ? ` Llevas una racha de ${progreso.racha_actual}.`
          : '') +
        (insigniasNuevas.length > 0
          ? ` ¡Nueva insignia: ${insigniasNuevas.join(', ')}!`
          : '')
      : 'Incorrecto. ¡Sigue intentando!';

    return {
      resultado: this.armarResultado(resultado),
      progreso: await this.armarProgreso(idUsuario, progreso),
      insignias_nuevas: insigniasNuevas,
      mensaje_voz: mensajeVoz,
    };
  }

  async finalizarSesion(
    idSesion: number,
    dto: FinalizarSesionDto,
    idUsuario: number,
  ): Promise<SesionFinalizadaDto> {
    const sesion = await this.buscarSesionPropia(idSesion, idUsuario);

    if (sesion.fecha_fin) {
      throw new BadRequestException(
        `La sesión ${idSesion} ya finalizó (${sesion.estado.toLowerCase()}).`,
      );
    }

    await this.sesionesRepo.update(idSesion, {
      estado: dto.estado_final,
      fecha_fin: new Date(),
    });

    // ─── Adaptación de dificultad (CU31, solo sesiones completadas) ───
    const desafioAsignado =
      dto.estado_final === 'COMPLETADA'
        ? await this.adaptarDificultad(idUsuario, idSesion)
        : null;

    // ─── Insignias nuevas (CU33) ───
    const insigniasNuevas = await this.evaluarYAsignarInsignias(idUsuario);

    const progreso = await this.getOrCreateProgreso(idUsuario);
    const finalizada = await this.buscarSesionPropia(idSesion, idUsuario);

    this.logger.log(
      `🎯 Sesión ${idSesion} → ${dto.estado_final} (${finalizada.puntos_obtenidos} pts).` +
        (desafioAsignado
          ? ` Desafío asignado: dificultad ${desafioAsignado.dificultad_asignada}.`
          : ''),
    );

    const mensajeVoz =
      dto.estado_final === 'COMPLETADA'
        ? `Sesión completada. Obtuviste ${finalizada.puntos_obtenidos} puntos.` +
          (desafioAsignado
            ? ' Se te asignó un nuevo desafío según tu rendimiento.'
            : '') +
          (insigniasNuevas.length > 0
            ? ` ¡Nueva insignia: ${insigniasNuevas.join(', ')}!`
            : '')
        : 'Sesión abandonada. Podrás intentarlo cuando quieras.';

    return {
      sesion: this.armarSesion(finalizada, null),
      progreso: await this.armarProgreso(idUsuario, progreso),
      desafio_asignado: desafioAsignado
        ? this.armarDesafio(desafioAsignado)
        : null,
      insignias_nuevas: insigniasNuevas,
      mensaje_voz: mensajeVoz,
    };
  }

  // ═══════════════════ PROGRESO (CU30) ═══════════════════

  async obtenerProgreso(idUsuario: number): Promise<ProgresoResponseDto> {
    const progreso = await this.getOrCreateProgreso(idUsuario);
    return this.armarProgreso(idUsuario, progreso);
  }

  // ═══════════════════ DESAFÍOS (CU31) ═══════════════════

  async listarDesafios(
    idUsuario: number,
    estado?: string,
  ): Promise<DesafioResponseDto[]> {
    const qb = this.desafiosRepo
      .createQueryBuilder('desafio')
      .leftJoinAndSelect('desafio.ejercicio', 'ejercicio')
      .where('desafio.id_usuario = :idUsuario', { idUsuario })
      .orderBy('desafio.fecha_asignacion', 'DESC')
      .take(20);

    if (estado) {
      qb.andWhere('desafio.estado = :estado', { estado });
    }

    const desafios = await qb.getMany();
    return desafios.map((d) => this.armarDesafio(d));
  }

  async actualizarDesafio(
    idDesafio: number,
    dto: ActualizarDesafioDto,
    idUsuario: number,
  ): Promise<DesafioResponseDto> {
    const desafio = await this.desafiosRepo.findOne({
      where: { id_desafio: idDesafio },
      relations: { ejercicio: true },
    });

    // 404 si no existe o es de otro usuario (no filtra existencia)
    if (!desafio || Number(desafio.id_usuario) !== Number(idUsuario)) {
      throw new NotFoundException(
        `Desafío con id ${idDesafio} no encontrado.`,
      );
    }

    await this.desafiosRepo.update(idDesafio, {
      estado: dto.estado,
      ...(dto.estado === 'COMPLETADO' ? { fecha_completado: new Date() } : {}),
    });

    return this.armarDesafio({
      ...desafio,
      estado: dto.estado,
      fecha_completado:
        dto.estado === 'COMPLETADO' ? new Date() : desafio.fecha_completado,
    });
  }

  // ═══════════════════ INSIGNIAS (CU33) ═══════════════════

  async listarInsignias(): Promise<InsigniaResponseDto[]> {
    const insignias = await this.insigniasRepo.find({
      where: { estado: 'ACTIVA' },
      order: { nombre: 'ASC' },
    });
    return insignias.map((i) => this.armarInsignia(i, null));
  }

  async listarMisInsignias(idUsuario: number): Promise<InsigniaResponseDto[]> {
    const obtenidas = await this.usuariosInsigniasRepo.find({
      where: { id_usuario: idUsuario },
      relations: { insignia: true },
    });

    return obtenidas
      .filter((ui) => ui.insignia)
      .map((ui) => this.armarInsignia(ui.insignia, ui.fecha_obtencion));
  }

  // ═══════════════════ HELPERS ═══════════════════

  /** Progreso del usuario; crea la fila la primera vez que entrena */
  private async getOrCreateProgreso(idUsuario: number): Promise<ProgresoVc> {
    let progreso = await this.progresoRepo.findOne({
      where: { id_usuario: idUsuario },
    });
    if (!progreso) {
      progreso = await this.progresoRepo.save(
        this.progresoRepo.create({ id_usuario: idUsuario }),
      );
      this.logger.log(`🎯 Progreso VisionCoach creado para usuario ${idUsuario}.`);
    }
    return progreso;
  }

  /**
   * Evalúa las insignias ACTIVAS contra el progreso y otorga las
   * que cumplan su `condicion` ("campo >= N") y aún no se tengan.
   * Devuelve los NOMBRES de las recién obtenidas (para TTS).
   */
  private async evaluarYAsignarInsignias(idUsuario: number): Promise<string[]> {
    const progreso = await this.getOrCreateProgreso(idUsuario);
    const insignias = await this.insigniasRepo.find({
      where: { estado: 'ACTIVA' },
    });

    const obtenidas = new Set(
      (
        await this.usuariosInsigniasRepo.find({
          where: { id_usuario: idUsuario },
          select: { id_insignia: true },
        })
      ).map((ui) => Number(ui.id_insignia)),
    );

    const valores: Record<string, number> = {
      nivel: progreso.nivel,
      puntos_totales: progreso.puntos_totales,
      racha_actual: progreso.racha_actual,
      mejor_racha: progreso.mejor_racha,
      ejercicios_completados: progreso.ejercicios_completados,
    };

    const nuevas: string[] = [];
    for (const insignia of insignias) {
      if (obtenidas.has(Number(insignia.id_insignia))) continue;

      const match = insignia.condicion?.match(PATRON_CONDICION);
      if (!match) {
        if (insignia.condicion) {
          this.logger.warn(
            `Insignia '${insignia.nombre}' con condición no interpretable: '${insignia.condicion}'.`,
          );
        }
        continue;
      }

      const [, campo, umbralStr] = match;
      const valor = valores[campo];
      if (valor === undefined) continue; // campo desconocido → ignorar

      if (valor >= Number(umbralStr)) {
        // PK compuesta → verificar de nuevo por si llegó en paralelo
        await this.usuariosInsigniasRepo
          .insert({
            id_usuario: idUsuario,
            id_insignia: Number(insignia.id_insignia),
          })
          .then(() => nuevas.push(insignia.nombre))
          .catch(() => {
            // duplicada (carrera) → ignorar silenciosamente
          });
      }
    }

    if (nuevas.length > 0) {
      this.logger.log(
        `🏅 Usuario ${idUsuario} obtuvo insignias: ${nuevas.join(', ')}.`,
      );
    }
    return nuevas;
  }

  /**
   * CU31 — asigna un desafío con dificultad ajustada según la
   * sesión: ≥80% aciertos → max+1; <40% → min−1 (acotado 1..5).
   * Si no aplica (sin resultados o rendimiento intermedio) → null.
   */
  private async adaptarDificultad(
    idUsuario: number,
    idSesion: number,
  ): Promise<DesafioVc | null> {
    const resultados = await this.resultadosRepo.find({
      where: { id_sesion: idSesion },
      relations: { ejercicio: true },
    });

    const conDificultad = resultados
      .filter((r) => r.correcto !== null && r.ejercicio)
      .map((r) => ({
        correcto: r.correcto === true,
        dificultad: r.ejercicio.dificultad,
      }));
    if (conDificultad.length === 0) return null;

    const aciertos = conDificultad.filter((r) => r.correcto).length;
    const tasa = aciertos / conDificultad.length;
    const dificultades = conDificultad.map((r) => r.dificultad);

    let objetivo: number | null = null;
    let motivo: string | null = null;
    if (tasa >= UMBRAL_SUBIR) {
      objetivo = Math.min(5, Math.max(...dificultades) + 1);
      motivo = `Rendimiento alto en la sesión #${idSesion}: ${aciertos}/${conDificultad.length} aciertos.`;
    } else if (tasa < UMBRAL_BAJAR) {
      objetivo = Math.max(1, Math.min(...dificultades) - 1);
      motivo = `Sesión #${idSesion} difícil (${aciertos}/${conDificultad.length} aciertos): bajamos un nivel.`;
    }
    if (objetivo === null) return null;

    // Un ejercicio ACTIVO con la dificultad objetivo (aleatorio)
    const candidatos = await this.ejerciciosRepo.find({
      where: { estado: 'ACTIVO', dificultad: objetivo },
    });
    if (candidatos.length === 0) return null;
    const ejercicio =
      candidatos[Math.floor(Math.random() * candidatos.length)];

    return this.desafiosRepo.save(
      this.desafiosRepo.create({
        id_usuario: idUsuario,
        id_ejercicio: Number(ejercicio.id_ejercicio),
        dificultad_asignada: objetivo,
        motivo_adaptacion: motivo,
        estado: 'ASIGNADO',
      }),
    );
  }

  /** Sesión propia (404 si ajena o inexistente), con resultados */
  private async buscarSesionPropia(
    idSesion: number,
    idUsuario: number,
  ): Promise<SesionVc> {
    const sesion = await this.sesionesRepo.findOne({
      where: { id_sesion: idSesion },
      relations: { resultados: { ejercicio: true } },
    });
    if (!sesion || Number(sesion.id_usuario) !== Number(idUsuario)) {
      throw new NotFoundException(
        `Sesión con id ${idSesion} no encontrada.`,
      );
    }
    return sesion;
  }

  // ─── Armado de respuestas ───

  private armarEjercicio(e: EjercicioVc): EjercicioResponseDto {
    return {
      id_ejercicio: Number(e.id_ejercicio),
      id_categoria: Number(e.id_categoria),
      categoria_nombre: e.categoria?.nombre ?? null,
      nombre: e.nombre,
      descripcion: e.descripcion,
      dificultad: e.dificultad,
      puntos_base: e.puntos_base,
      duracion_estimada_segundos: e.duracion_estimada_segundos,
    };
  }

  private armarSesion(s: SesionVc, mensajeVoz: string | null): SesionResponseDto {
    return {
      id_sesion: Number(s.id_sesion),
      id_usuario: Number(s.id_usuario),
      fecha_inicio: s.fecha_inicio,
      fecha_fin: s.fecha_fin,
      puntos_obtenidos: s.puntos_obtenidos,
      estado: s.estado,
      resultados: s.resultados?.map((r) => this.armarResultado(r)),
      mensaje_voz: mensajeVoz,
    };
  }

  private armarResultado(r: ResultadoVc): ResultadoResponseDto {
    return {
      id_resultado: Number(r.id_resultado),
      id_sesion: Number(r.id_sesion),
      id_ejercicio: Number(r.id_ejercicio),
      respuesta: r.respuesta,
      correcto: r.correcto,
      puntuacion: r.puntuacion,
      tiempo_segundos: r.tiempo_segundos,
      fecha_resultado: r.fecha_resultado,
    };
  }

  private async armarProgreso(
    idUsuario: number,
    p: ProgresoVc,
  ): Promise<ProgresoResponseDto> {
    const totalInsignias = await this.usuariosInsigniasRepo.count({
      where: { id_usuario: idUsuario },
    });
    return {
      id_usuario: Number(p.id_usuario),
      nivel: p.nivel,
      puntos_totales: p.puntos_totales,
      racha_actual: p.racha_actual,
      mejor_racha: p.mejor_racha,
      ejercicios_completados: p.ejercicios_completados,
      total_insignias: totalInsignias,
    };
  }

  private armarDesafio(d: DesafioVc): DesafioResponseDto {
    return {
      id_desafio: Number(d.id_desafio),
      id_ejercicio: Number(d.id_ejercicio),
      ejercicio_nombre: d.ejercicio?.nombre ?? null,
      dificultad_asignada: d.dificultad_asignada,
      motivo_adaptacion: d.motivo_adaptacion,
      estado: d.estado,
      fecha_asignacion: d.fecha_asignacion,
      fecha_completado: d.fecha_completado,
    };
  }

  private armarInsignia(
    i: InsigniaVc,
    fechaObtencion: Date | null,
  ): InsigniaResponseDto {
    return {
      id_insignia: Number(i.id_insignia),
      nombre: i.nombre,
      descripcion: i.descripcion,
      condicion: i.condicion,
      fecha_obtencion: fechaObtencion,
    };
  }
}
