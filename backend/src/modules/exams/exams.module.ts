// ============================================================
//  ExamsModule : CRUD des examens.
//  Importe SubjectsModule + QuestionsModule pour valider la
//  matière et la composition (réutilisation des services).
// ============================================================
import { Module } from '@nestjs/common';
import { QuestionsModule } from '../questions/questions.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  imports: [SubjectsModule, QuestionsModule],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
