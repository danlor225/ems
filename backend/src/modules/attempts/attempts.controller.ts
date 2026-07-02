// ============================================================
//  AttemptsController : routes du passage d'évaluation (STUDENT).
// ============================================================
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { SafeUser } from '../auth/auth.service';
import { AttemptsService } from './attempts.service';
import { SaveAnswerDto } from './dto/save-answer.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT) // le passage d'évaluation est réservé aux étudiants
@Controller()
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  // POST /api/sessions/:sessionId/start
  @Post('sessions/:sessionId/start')
  @HttpCode(HttpStatus.CREATED)
  start(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.attemptsService.start(user.id, sessionId);
  }

  // PATCH /api/attempts/:id/answers — sauvegarde automatique d'une réponse
  @Patch('attempts/:id/answers')
  @HttpCode(HttpStatus.OK)
  saveAnswer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAnswerDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.attemptsService.saveAnswer(user.id, id, dto);
  }

  // POST /api/attempts/:id/submit — soumission + calcul de la note
  @Post('attempts/:id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.attemptsService.submit(user.id, id);
  }

  // GET /api/attempts/me — historique de l'étudiant connecté.
  // Déclarée AVANT ':id/result' (route statique prioritaire).
  @Get('attempts/me')
  history(@CurrentUser() user: SafeUser) {
    return this.attemptsService.getHistory(user.id);
  }

  // GET /api/attempts/:id/result — bouton "Voir ma note" (correction).
  @Get('attempts/:id/result')
  result(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.attemptsService.getResult(user.id, id);
  }
}
