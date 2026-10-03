import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtConfig } from '../../config/jwt.config';
import { Perfil } from '../usuarios/entities/perfil.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

import { HistorialModule } from '../historial/historial.module';

/**
 * ══════════════════════════════════════════════════════
 * Módulo de autenticación.
 *
 * - Registra Usuario y Perfil para repositorios propios.
 * - JwtModule configurado con secret/expiración del .env
 *   (el service además firma con opciones explícitas).
 * - JwtStrategy: provider que passport usa al validar tokens.
 * - Exporta AuthService: lo consumirán otros módulos
 *   (p. ej. usuarios para cambiar contraseña).
 * ══════════════════════════════════════════════════════
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Perfil]),

    HistorialModule, // 🆕 — para registrar eventos

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const jwt = config.get<JwtConfig>('jwt')!;
        return {
          secret: jwt.secret,
          signOptions: {
            expiresIn: jwt.segundosValidez, // number = segundos
            issuer: jwt.issuer,
          },
        };
      },
    }),
  ],

  controllers: [AuthController],

  providers: [AuthService, JwtStrategy],

  exports: [AuthService],
})
export class AuthModule {}