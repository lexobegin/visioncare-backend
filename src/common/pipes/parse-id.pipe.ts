import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * ══════════════════════════════════════════════════════
 * Pipe para parámetros de ruta que son IDs.
 *
 * Valida que sea entero >= 1 y lo convierte a number.
 * Reutilizable en todos los módulos:
 *
 *   @Param('id', ParseIdPipe) id: number
 * ══════════════════════════════════════════════════════
 */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(valor: string): number {
    const id = Number(valor);

    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException(
        'El parámetro id debe ser un número entero mayor o igual a 1.',
      );
    }

    return id;
  }
}