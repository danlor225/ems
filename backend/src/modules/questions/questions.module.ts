// ============================================================
//  QuestionsModule : CRUD des questions.
//  Importe SubjectsModule pour injecter SubjectsService
//  (validation de l'existence d'une matière).
// ============================================================
import { Module } from '@nestjs/common';
import { SubjectsModule } from '../subjects/subjects.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [SubjectsModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
