import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ConfigService : accès typé aux variables validées.
  const config = app.get(ConfigService);

  // 1) Helmet : ajoute des en-têtes HTTP de sécurité (protège contre plusieurs
  //    attaques : clickjacking, sniffing MIME, etc.) — OWASP A05.
  app.use(helmet());

  // 2) CORS : seule l'origine du front est autorisée à appeler l'API.
  //    credentials: true => nécessaire pour envoyer/recevoir les cookies (refresh token).
  //    - En PROD : on liste les origines réelles via CORS_ORIGIN (séparées par des virgules).
  //    - En DEV  : si CORS_ORIGIN est absent, on retombe sur http://localhost:FRONTEND_PORT.
  //  cookieParser : parse l'en-tête Cookie => req.cookies (lecture du refresh token httpOnly).
  app.use(cookieParser());

  const corsOrigin = config.get<string>('CORS_ORIGIN');
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((o) => o.trim())
      : `http://localhost:${config.get<number>('FRONTEND_PORT')}`,
    credentials: true,
  });

  // 3) Préfixe global : toutes les routes seront sous /api (ex: /api/auth/login).
  app.setGlobalPrefix('api');

  // 4) ValidationPipe global : valide et nettoie TOUTES les données entrantes.
  //    - whitelist            : retire les champs non déclarés dans les DTO
  //    - forbidNonWhitelisted : rejette carrément une requête avec des champs en trop
  //    - transform            : convertit les payloads en instances de DTO typées
  //    => protection contre l'injection de données parasites (OWASP A03/A08).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 5) Arrêt propre : déclenche onModuleDestroy (donc la déconnexion Prisma).
  app.enableShutdownHooks();

  const port = config.get<number>('BACKEND_PORT') ?? 3000;
  await app.listen(port);

  console.log(`✅ EMS API démarrée sur http://localhost:${port}/api`);
}
bootstrap();
