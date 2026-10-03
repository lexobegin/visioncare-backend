import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO de paginación reutilizable.
 *
 * Cualquier endpoint de listado lo hereda y recibe:
 *   GET /api/v1/usuarios?page=2&limit=20&buscar=maria
 *
 * Los getters skip/take se usan directo en TypeORM:
 *   repository.find({ skip: dto.skip, take: dto.take })
 * ══════════════════════════════════════════════════════
 */
export class PaginationDto {
  /** Número de página (1 en adelante) */
  @ApiPropertyOptional({ default: 1, minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un número entero.' })
  @Min(1, { message: 'page debe ser mayor o igual a 1.' })
  page: number = 1;

  /** Registros por página (1–100, se limita para proteger la BD) */
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero.' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1.' })
  @Max(100, { message: 'limit no puede ser mayor a 100.' })
  limit: number = 10;

  /** Búsqueda opcional de texto libre (según cada módulo) */
  @ApiPropertyOptional({
    description: 'Texto libre para filtrar resultados',
    example: 'maria',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'buscar no puede estar vacío.' })
  buscar?: string;

  /** Registros a saltar (TypeORM) */
  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  /** Registros a tomar (TypeORM) */
  get take(): number {
    return this.limit;
  }
}

/**
 * Envoltura estándar para respuestas paginadas.
 *
 * {
 *   ok: true,
 *   datos: [...],
 *   meta: { page, limit, total, totalPaginas }
 * }
 */
export interface RespuestaPaginada<T> {
  ok: true;
  datos: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPaginas: number;
  };
}

/** Helper para armar la respuesta paginada desde un service/controller */
export function construirRespuestaPaginada<T>(
  datos: T[],
  total: number,
  paginacion: PaginationDto,
): RespuestaPaginada<T> {
  return {
    ok: true,
    datos,
    meta: {
      page: paginacion.page,
      limit: paginacion.limit,
      total,
      totalPaginas: Math.ceil(total / paginacion.limit),
    },
  };
}