// ============================================================
//  SessionsModule : planification des sessions d'examen.
//  Importe ExamsModule pour valider qu'un examen est publié.
// ============================================================
import { Module } from '@nestjs/common';
import { ExamsModule } from '../exams/exams.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [ExamsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
