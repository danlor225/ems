// ============================================================
//  SubjectsModule : regroupe le CRUD des matières.
//  Exporte SubjectsService (les questions/examens en auront besoin).
// ============================================================
import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

@Module({
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
