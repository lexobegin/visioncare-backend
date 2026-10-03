import { registerAs } from '@nestjs/config';

/**
 * ══════════════════════════════════════════════════════
 * Configuración JWT (namespaced como 'jwt')
 * Lee JWT_SECRET, JWT_EXPIRES_IN y JWT_ISSUER del .env.
 * Falla al arrancar si el secreto es débil (seguridad).
 * Acceso: configService.get<JwtConfig>('jwt')
 * ══════════════════════════════════════════════════════
 */
export interface JwtConfig {
  secret: string;
  expiresIn: string;
  issuer: string;
  /** Validez del token en segundos (para expires_in en las respuestas) */
  segundosValidez: number;
}

/** Convierte '8h' → 28800 | '30m' → 1800 | '7d' → 604800 */
function expiracionASegundos(valor: string): number {
  const coincidencia = /^(\d+)\s*([smhd])$/i.exec(valor.trim());
  if (!coincidencia) return 8 * 3600; // fallback: 8 horas

  const cantidad = parseInt(coincidencia[1], 10);
  const factores = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  return cantidad * factores[coincidencia[2].toLowerCase() as keyof typeof factores];
}

export default registerAs('jwt', (): JwtConfig => {
  const secret = (process.env.JWT_SECRET || '').trim();

  if (secret.length < 32) {
    throw new Error(
      'JWT_SECRET es obligatoria y debe tener al menos 32 caracteres. ' +
        'Genera una con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

  return {
    secret,
    expiresIn,
    issuer: process.env.JWT_ISSUER || 'visioncare-ai',
    segundosValidez: expiracionASegundos(expiresIn),
  };
});