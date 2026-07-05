// ============================================================
//  UsersModule : regroupe tout ce qui concerne les utilisateurs.
//  Il EXPORTE UsersService pour que d'autres modules (AuthModule)
//  puissent l'injecter.
// ============================================================
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // rendu disponible aux modules qui importent UsersModule
})
export class UsersModule {}
