// ============================================================
//  PrismaModule : expose PrismaService à toute l'application.
//
//  @Global() => pas besoin de réimporter ce module dans chaque
//  module métier ; PrismaService est disponible partout (DRY).
//  On l'importe UNE fois dans AppModule.
// ============================================================
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // exporté => injectable dans les autres modules
})
export class PrismaModule {}
