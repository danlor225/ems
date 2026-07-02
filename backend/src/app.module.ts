import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { ExamsModule } from './modules/exams/exams.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // ConfigModule : charge le .env RACINE et le valide au démarrage.
    ConfigModule.forRoot({
      isGlobal: true, // ConfigService injectable partout, sans réimport
      envFilePath: '../.env', // le .env est à la racine ; le backend démarre depuis backend/
      validate: validateEnv, // rejette le démarrage si une variable manque/est invalide
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
