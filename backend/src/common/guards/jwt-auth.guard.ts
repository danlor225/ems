// ============================================================
//  JwtAuthGuard : le "videur" des routes protégées.
//  On l'applique via @UseGuards(JwtAuthGuard). Il déclenche la
//  stratégie 'jwt' ; si le token est absent/invalide/expiré,
//  la requête est rejetée avec un 401 avant d'atteindre le contrôleur.
// ============================================================
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
