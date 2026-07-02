// ============================================================
//  SessionsController : routes /api/sessions.
//  - /available : accessible à tout utilisateur authentifié (STUDENT).
//  - les autres routes : réservées TEACHER/ADMIN (@Roles par méthode).
//  IMPORTANT : la route statique 'available' est déclarée AVANT ':id'
//  pour ne pas être capturée par le paramètre.
// ============================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionsService } from './sessions.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  create(@Body() dto: CreateSessionDto) {
    return this.sessionsService.create(dto);
  }

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  findAll(@Query() query: SessionQueryDto) {
    return this.sessionsService.findAll(query);
  }

  // Vue étudiant : pas de @Roles => tout utilisateur authentifié.
  @Get('available')
  findAvailable() {
    return this.sessionsService.findAvailable();
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSessionDto) {
    return this.sessionsService.update(id, dto);
  }

  @Post(':id/close')
  @Roles(Role.TEACHER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  close(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.close(id);
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.remove(id);
  }
}
