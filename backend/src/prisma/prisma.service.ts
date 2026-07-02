// ============================================================
//  PrismaService : le point d'accès UNIQUE à la base de données.
//
//  Il ÉTEND PrismaClient (le client généré) et se branche sur le
//  cycle de vie NestJS pour ouvrir/fermer la connexion proprement :
//   - onModuleInit   -> se connecte quand le module démarre
//   - onModuleDestroy-> se déconnecte quand l'appli s'arrête
//
//  Étant un provider NestJS, il est instancié UNE SEULE FOIS
//  (singleton) et injecté partout où on en a besoin.
// ============================================================
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    // Établit la connexion au démarrage du module.
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    // Ferme proprement la connexion à l'arrêt (évite les connexions fantômes).
    await this.$disconnect();
  }
}
