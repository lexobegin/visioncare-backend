import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { RegistrarCapturaDto } from './registrar-captura.dto';
import { TipoAnalisis } from './tipo-analisis.enum';

describe('RegistrarCapturaDto - Validación de Contrato de API', () => {
  let targetPipe: ValidationPipe;
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: RegistrarCapturaDto,
    data: '',
  };

  beforeEach(() => {
    // Configuración exacta del ValidationPipe global de main.ts
    targetPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });
  });

  describe('Caso 1: Con datos GPS completos (latitud, longitud, precision_gps)', () => {
    it('debe validar y transformar correctamente cuando se envía GPS completo desde el móvil', async () => {
      const payloadMultipart = {
        tipo_analisis: TipoAnalisis.OBJETOS,
        origen: 'CAMARA',
        reconocer: 'true',
        latitud: '-17.7833',
        longitud: '-63.1821',
        precision_gps: '12.5',
      };

      const resultado = await targetPipe.transform(payloadMultipart, metadata);

      expect(resultado).toBeInstanceOf(RegistrarCapturaDto);
      expect(resultado.tipo_analisis).toBe(TipoAnalisis.OBJETOS);
      expect(resultado.origen).toBe('CAMARA');
      expect(resultado.reconocer).toBe(true);
      expect(resultado.latitud).toBe(-17.7833);
      expect(resultado.longitud).toBe(-63.1821);
      expect(resultado.precision_gps).toBe(12.5);
    });
  });

  describe('Caso 2: Sin datos GPS (móvil con GPS desactivado)', () => {
    it('debe validar exitosamente cuando los campos de GPS se omiten', async () => {
      const payloadSinGps = {
        tipo_analisis: TipoAnalisis.OBJETOS,
        origen: 'CAMARA',
        reconocer: true,
      };

      const resultado = await targetPipe.transform(payloadSinGps, metadata);

      expect(resultado).toBeInstanceOf(RegistrarCapturaDto);
      expect(resultado.latitud).toBeUndefined();
      expect(resultado.longitud).toBeUndefined();
      expect(resultado.precision_gps).toBeUndefined();
    });
  });

  describe('Caso 3: Regresión de seguridad (forbidNonWhitelisted)', () => {
    it('debe rechazar con 400 Bad Request si se envían propiedades no declaradas en el DTO', async () => {
      const payloadConCampoDesconocido = {
        tipo_analisis: TipoAnalisis.OBJETOS,
        campo_inexistente_o_invalido: 'valor',
      };

      await expect(
        targetPipe.transform(payloadConCampoDesconocido, metadata),
      ).rejects.toThrow(BadRequestException);

      try {
        await targetPipe.transform(payloadConCampoDesconocido, metadata);
      } catch (err: any) {
        expect(err.getResponse().message).toContain(
          'property campo_inexistente_o_invalido should not exist',
        );
      }
    });
  });

  describe('Caso 4: Validaciones de restricciones de dominio para precision_gps y coordenadas', () => {
    it('debe rechazar si precision_gps es un valor negativo', async () => {
      const payloadPrecisionNegativa = {
        tipo_analisis: TipoAnalisis.OBJETOS,
        latitud: -17.7833,
        longitud: -63.1821,
        precision_gps: -5,
      };

      await expect(
        targetPipe.transform(payloadPrecisionNegativa, metadata),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si latitud está fuera de rango permitido (-90 a 90)', async () => {
      const payloadLatitudInvalida = {
        latitud: 95.5,
        longitud: -63.1821,
      };

      await expect(
        targetPipe.transform(payloadLatitudInvalida, metadata),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si longitud está fuera de rango permitido (-180 a 180)', async () => {
      const payloadLongitudInvalida = {
        latitud: -17.7833,
        longitud: 195.5,
      };

      await expect(
        targetPipe.transform(payloadLongitudInvalida, metadata),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

