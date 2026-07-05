import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { ExamsModule } from './modules/exams/exams.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AttemptsModule } from './modules/attempts/attempts.module';
import { ResultsModule } from './modules/results/results.module';
import { StatsModule } from './modules/stats/stats.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { AcademicSessionsModule } from './modules/academic-sessions/academic-sessions.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { GroupsModule } from './modules/groups/groups.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // ConfigModule : charge le .env RACINE et le valide au démarrage.
    ConfigModule.forRoot({
      isGlobal: true, // ConfigService injectable partout, sans réimport
      envFilePath: '../.env', // le .env est à la racine ; le backend démarre depuis backend/
      validate: validateEnv, // rejette le démarrage si une variable manque/est invalide
    }),
    // ThrottlerModule : limite générale de 100 requêtes / minute / IP.
    // (stockage en mémoire ; en multi-instances on utiliserait Redis)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // PrismaModule : accès à la base de données, disponible globalement.
    PrismaModule,
    // AuthModule : inscription / connexion (routes /api/auth/...).
    AuthModule,
    // SubjectsModule : CRUD des matières (routes /api/subjects/...).
    SubjectsModule,
    // QuestionsModule : CRUD des questions (routes /api/questions/...).
    QuestionsModule,
    // ExamsModule : CRUD des examens (routes /api/exams/...).
    ExamsModule,
    // SessionsModule : planification des sessions (routes /api/sessions/...).
    SessionsModule,
    // AttemptsModule : passage d'évaluation côté étudiant.
    AttemptsModule,
    // ResultsModule : consultation des résultats (staff).
    ResultsModule,
    // StatsModule : statistiques du tableau de bord (staff).
    StatsModule,
    // ActivityLogModule (@Global) : audit des actions sensibles.
    ActivityLogModule,
    // v2 : conteneurs académiques + évaluations.
    AcademicSessionsModule,
    EvaluationsModule,
    // v2 : groupes / classes (routes /api/groups/...).
    GroupsModule,
    // v2 : certificats de réussite (routes /api/certificates/...).
    CertificatesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard global : applique le rate limiting à TOUTES les routes.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
