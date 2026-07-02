// ============================================================
//  ResultsModule : consultation des résultats (staff).
//  Importe AttemptsModule pour réutiliser la correction détaillée.
// ============================================================
import { Module } from '@nestjs/common';
import { AttemptsModule } from '../attempts/attempts.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [AttemptsModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
