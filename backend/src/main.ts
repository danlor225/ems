import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ConfigService : accès typé aux variables validées.
  const config = app.get(ConfigService);

  // 1) Helmet : ajoute des en-têtes HTTP de sécurité (protège contre plusieurs
  //    attaques : clickjacking, sniffing MIME, etc.) — OWASP A05.
  app.use(helmet());

  // 2) CORS : seul le front (sur son port) est autorisé à appeler l'API.
  //    credentials: true => nécessaire pour envoyer/recevoir les cookies (refresh token).
  app.enableCors({
    origin: `http://localhost:${config.get<number>('FRONTEND_PORT')}`,
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
