//import {
//  PrimaryGeneratedColumnNumericOptions,
//  ValueTransformer,
//} from 'typeorm';

import { ValueTransformer } from 'typeorm';

/**
 * ══════════════════════════════════════════════════════
 * Transformer para columnas BIGINT de PostgreSQL.
 *
 * El driver pg devuelve los BIGINT como string ("1"), lo que
 * causa inconsistencias en comparaciones y respuestas JSON.
 * Este transformer los convierte a number de forma transparente.
 *
 * Uso (columnas normales):
 *   @Column({ type: 'bigint', transformer: BigIntTransformer })
 * ══════════════════════════════════════════════════════
 */
export const BigIntTransformer: ValueTransformer = {
  // JS → BD (al guardar/consultar)
  to: (valor: number | null | undefined): number | null => valor ?? null,

  // BD → JS (al leer)
  from: (valor: string | number | null): number | null =>
    valor === null || valor === undefined ? null : Number(valor),
};

/**
 * ══════════════════════════════════════════════════════
 * Opciones para CLAVES PRIMARIAS BIGINT con transformer.
 *
 * PrimaryGeneratedColumn no declara 'transformer' en sus
 * tipos (solo Column lo hace), pero TypeORM sí lo aplica en
 * ejecución. Este helper centraliza el cast tipado para
 * reutilizarlo en todas las entidades:
 *
 *   @PrimaryGeneratedColumn(BigIntPKColumn)
 *   id_xxx: number;
 * ══════════════════════════════════════════════════════
 */
export const BigIntPKColumn = {
  type: 'bigint',
  transformer: BigIntTransformer,
} as const;
//} as unknown as PrimaryGeneratedColumnNumericOptions;