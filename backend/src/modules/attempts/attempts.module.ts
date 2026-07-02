// ============================================================
//  AttemptsModule : passage d'évaluation.
//  Importe SessionsModule pour charger la session + composition.
// ============================================================
import { Module } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';

@Module({
  imports: [SessionsModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
