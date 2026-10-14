import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RolUsuario } from '../entities/usuario.entity';

/** Datos necesarios para que un ADMIN cree una cuenta y su perfil. */
export class AdminCrearUsuarioDto {
  @IsString({ message: 'nombres debe ser texto.' })
  @MinLength(2, { message: 'nombres debe tener al menos 2 caracteres.' })
  @MaxLength(100, { message: 'nombres no puede superar 100 caracteres.' })
  nombres: string;

  @IsOptional()
  @IsString({ message: 'apellidos debe ser texto.' })
  @MaxLength(100, { message: 'apellidos no puede superar 100 caracteres.' })
  apellidos?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'correo no tiene un formato válido.' })
  @MaxLength(150, { message: 'correo no puede superar 150 caracteres.' })
  correo: string;

  @IsString({ message: 'contrasena debe ser texto.' })
  @MinLength(8, { message: 'contrasena debe tener al menos 8 caracteres.' })
  @Matches(/[A-Z]/, {
    message: 'contrasena debe contener al menos una letra mayúscula.',
  })
  @Matches(/[a-z]/, {
    message: 'contrasena debe contener al menos una letra minúscula.',
  })
  @Matches(/[0-9]/, {
    message: 'contrasena debe contener al menos un número.',
  })
  contrasena: string;

  @IsIn(['USUARIO', 'ADMIN', 'INSTITUCION'], {
    message: 'rol solo acepta: USUARIO, ADMIN, INSTITUCION.',
  })
  rol: RolUsuario;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'id_institucion debe ser un número entero.' })
  @Min(1, { message: 'id_institucion debe ser mayor o igual a 1.' })
  id_institucion?: number | null;
}
