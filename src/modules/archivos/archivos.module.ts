import { Global, Module } from '@nestjs/common';
import { R2Service } from './r2.service';

/**
 * ══════════════════════════════════════════════════════
 * Módulo GLOBAL de archivos (Cloudflare R2).
 * Global = cualquier módulo inyecta R2Service sin importarlo.
 * ══════════════════════════════════════════════════════
 */
@Global()
@Module({
  providers: [R2Service],
  exports: [R2Service],
})
export class ArchivosModule {}