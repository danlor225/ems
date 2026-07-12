// ============================================================
//  AuthController : expose les routes d'authentification.
//  Il ne contient AUCUNE logique métier : il reçoit, valide
//  (via le DTO + ValidationPipe) et délègue à AuthService.
// ============================================================
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from './auth.service';
import type { SafeUser } from './auth.service';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookieOptions,
  refreshCookieOptions,
} from './auth.cookie';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth') // préfixe des routes : /api/auth/...
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

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
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    const { refreshToken, ...rest } = await this.authService.login(dto, {
      ip,
      userAgent,
    });
    // Le refresh token part en cookie httpOnly (jamais exposé au JS du navigateur).
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(this.config));
    // On ne renvoie que l'access token + l'utilisateur dans le corps.
    return rest;
  }

  // POST /api/auth/refresh — échange le refresh token (lu dans le cookie) contre une
  // nouvelle paire (rotation). Aucun token n'est attendu dans le corps.
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Refresh token manquant.');
    }
    const { refreshToken, accessToken } = await this.authService.refresh(token);
    // Rotation : on repose le NOUVEAU refresh token en cookie.
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(this.config));
    return { accessToken };
  }

  // POST /api/auth/logout — révoque le refresh token (cookie) et l'efface côté client.
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT) // 204 : succès sans contenu renvoyé
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
  }

  // GET /api/auth/me — route PROTÉGÉE : nécessite un access token valide.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: SafeUser) {
    // À ce stade, la JwtStrategy a déjà validé le token et chargé l'utilisateur.
    return user;
  }

  // PATCH /api/auth/me — met à jour le profil (prénom / nom).
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(
    @CurrentUser() user: SafeUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  // PATCH /api/auth/password — change le mot de passe.
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() user: SafeUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
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
