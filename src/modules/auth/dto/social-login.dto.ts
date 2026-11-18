import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class PerfilSocialDto {
  @ApiPropertyOptional({ example: 'Juan' })
  @IsOptional()
  @IsString()
  nombres?: string;

  @ApiPropertyOptional({ example: 'Pérez' })
  @IsOptional()
  @IsString()
  apellidos?: string;

  @ApiPropertyOptional({ example: 'https://lh3.googleusercontent.com/...' })
  @IsOptional()
  @IsString()
  fotoUrl?: string;
}

/**
 * DTO para autenticación social (Google One Tap, Apple, Facebook).
 * CU-02 Social Login.
 */
export class SocialLoginDto {
  @ApiProperty({
    example: 'google',
    enum: ['google', 'apple', 'facebook', 'biometrico'],
    description: 'Proveedor de identidad social o biométrica',
  })
  @IsString()
  @IsIn(['google', 'apple', 'facebook', 'biometrico'])
  proveedor: 'google' | 'apple' | 'facebook' | 'biometrico';

  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
    description: 'Token de identidad (ID Token o Access Token del proveedor)',
  })
  @IsString()
  @IsNotEmpty({ message: 'El token social es obligatorio.' })
  token: string;

  @ApiPropertyOptional({
    example: 'USUARIO',
    enum: ['USUARIO', 'ADMIN', 'INSTITUCION'],
    description: 'Rol solicitado para la cuenta si es un nuevo usuario',
  })
  @IsOptional()
  @IsIn(['USUARIO', 'ADMIN', 'INSTITUCION'])
  rol?: 'USUARIO' | 'ADMIN' | 'INSTITUCION';

  @ApiPropertyOptional({
    type: PerfilSocialDto,
    description: 'Información opcional del perfil recibida del cliente',
  })
  @IsOptional()
  @IsObject()
  perfil?: PerfilSocialDto;
}
