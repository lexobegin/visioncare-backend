import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * ══════════════════════════════════════════════════════
 * DTO: POST /contactos  (CU05)
 *
 * Regla "al menos un medio de contacto" (CHECK de la BD):
 *   - telefono es OBLIGATORIO si no se envía correo
 *   - correo es OBLIGATORIO si no se envía teléfono
 * Lograda con @ValidateIf: el ValidationPipe global rechaza
 * la petición antes de llegar a la BD.
 * ══════════════════════════════════════════════════════
 */
export class CrearContactoDto {
  @ApiProperty({ example: 'Rosa Pérez' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'nombre debe ser texto.' })
  @MinLength(2, { message: 'nombre debe tener al menos 2 caracteres.' })
  @MaxLength(120, { message: 'nombre no puede superar 120 caracteres.' })
  nombre: string;

  @ApiPropertyOptional({ example: 'Madre' })
  @IsOptional()
  @IsString({ message: 'parentesco debe ser texto.' })
  @MaxLength(80, { message: 'parentesco no puede superar 80 caracteres.' })
  parentesco?: string;

  @ApiPropertyOptional({
    example: '+591 70011122',
    description: 'Obligatorio si no se envía correo',
  })
  @ValidateIf((o: CrearContactoDto) => !o.correo)
  @IsNotEmpty({ message: 'Debe proporcionar al menos un teléfono o un correo.' })
  @IsOptional()
  @Matches(/^[+0-9\s().-]{7,30}$/, {
    message: 'telefono no tiene un formato válido (ej: +591 70011122).',
  })
  telefono?: string;

  @ApiPropertyOptional({
    example: 'rosa@correo.com',
    description: 'Obligatorio si no se envía teléfono',
  })
  @ValidateIf((o: CrearContactoDto) => !o.telefono)
  @IsNotEmpty({ message: 'Debe proporcionar al menos un teléfono o un correo.' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'correo no tiene un formato válido.' })
  @MaxLength(150, { message: 'correo no puede superar 150 caracteres.' })
  correo?: string;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    example: 1,
    description: 'Orden de notificación (1 = primero)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'prioridad debe ser un número entero.' })
  @Min(1, { message: 'prioridad debe ser mayor o igual a 1.' })
  prioridad?: number;

  @ApiPropertyOptional({
    default: false,
    example: true,
    description: 'Autorización para recibir la ubicación del usuario',
  })
  @IsOptional()
  @IsBoolean({ message: 'autorizado_ubicacion debe ser true o false.' })
  autorizado_ubicacion?: boolean;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: 'Autorización para recibir solicitudes de emergencia',
  })
  @IsOptional()
  @IsBoolean({ message: 'autorizado_emergencias debe ser true o false.' })
  autorizado_emergencias?: boolean;
}
