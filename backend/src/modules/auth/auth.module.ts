// ============================================================
//  AuthModule : regroupe l'authentification.
//  - IMPORTE UsersModule (pour injecter UsersService).
//  - Configure JwtModule de façon ASYNCHRONE, afin de lire les
//    secrets/durées depuis la config validée (ConfigService).
// ============================================================
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // registerAsync : on a besoin de ConfigService (donc d'une factory async).
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          // Cast sûr : la valeur est déjà validée par Zod au démarrage
          // (les typages récents de jsonwebtoken exigent le type StringValue).
          expiresIn: config.get<string>(
            'JWT_ACCESS_EXPIRES_IN',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenService, JwtStrategy],
})
export class AuthModule {}
