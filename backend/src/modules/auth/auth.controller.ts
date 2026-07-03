// ============================================================
//  AuthController : expose les routes d'authentification.
//  Il ne contient AUCUNE logique métier : il reçoit, valide
//  (via le DTO + ValidationPipe) et délègue à AuthService.
// ============================================================
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from './auth.service';
import type { SafeUser } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth') // préfixe des routes : /api/auth/...
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/auth/register — limite stricte : 5 tentatives / minute / IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED) // 201 : une ressource (utilisateur) a été créée
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /api/auth/login — limite stricte anti-brute-force : 5 / minute / IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK) // 200 : pas de création de ressource, juste une vérification
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // POST /api/auth/refresh — échange un refresh token contre une nouvelle paire.
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // POST /api/auth/logout — révoque le refresh token (déconnexion).
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT) // 204 : succès sans contenu renvoyé
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // GET /api/auth/me — route PROTÉGÉE : nécessite un access token valide.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: SafeUser) {
    // À ce stade, la JwtStrategy a déjà validé le token et chargé l'utilisateur.
    return user;
  }

  // GET /api/auth/admin-only — DÉMONSTRATION RBAC.
  // JwtAuthGuard (401 si non connecté) PUIS RolesGuard (403 si pas ADMIN).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin-only')
  adminOnly(@CurrentUser() user: SafeUser) {
    return { message: 'Accès administrateur autorisé.', email: user.email };
  }
}
