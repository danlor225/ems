import { Module } from '@nestjs/common';
import { AcademicSessionsModule } from '../academic-sessions/academic-sessions.module';
import { QuestionsModule } from '../questions/questions.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';

@Module({
  imports: [SubjectsModule, QuestionsModule, AcademicSessionsModule],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
