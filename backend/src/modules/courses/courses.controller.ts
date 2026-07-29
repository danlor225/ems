// ============================================================
//  CoursesController : routes /api/courses.
//  - JwtAuthGuard + RolesGuard au niveau CLASSE : toutes les routes
//    exigent d'être authentifié.
//  - @Roles(TEACHER, ADMIN) uniquement sur les écritures ; les lectures
//    (GET) restent accessibles à tout utilisateur connecté (étudiants
//    inclus), le service filtrant les cours non publiés.
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { SafeUser } from '../auth/auth.service';
import { CoursesService } from './courses.service';
import { CourseQueryDto } from './dto/course-query.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { GrantAccessDto } from './dto/grant-access.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { courseUploadMulter } from './upload.config';

// Réduit l'utilisateur JWT à ce dont le service a besoin (id + rôle +
// groupe, ce dernier servant à filtrer les cours réservés à un groupe).
function actor(user: SafeUser) {
  return { id: user.id, role: user.role, groupId: user.groupId };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly service: CoursesService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: SafeUser) {
    return this.service.create(dto, actor(user));
  }

  // Téléversement d'un fichier (document ou vidéo). Le type est passé en
  // query (?type=DOCUMENT|VIDEO) et sert à valider MIME + taille. Renvoie
  // l'URL publique à réutiliser comme `url` d'une ressource.
  @Post('upload')
  @Roles(Role.TEACHER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', courseUploadMulter))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: string,
  ) {
    return this.service.handleUpload(file, type);
  }

  @Get()
  findAll(@Query() query: CourseQueryDto, @CurrentUser() user: SafeUser) {
    return this.service.findAll(query, actor(user));
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.findOne(id, actor(user));
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.update(id, dto, actor(user));
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.remove(id, actor(user));
  }

  // -------- Présence (auto-déclarée) --------

  // L'étudiant se déclare présent au cours.
  @Post(':id/attendance')
  @Roles(Role.STUDENT)
  markAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.markAttendance(id, actor(user));
  }

  // Le staff consulte la feuille de présence.
  @Get(':id/attendance')
  @Roles(Role.TEACHER, Role.ADMIN)
  listAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.listAttendance(id, actor(user));
  }

  // -------- Accès (cours payants) --------

  @Get(':id/access')
  @Roles(Role.TEACHER, Role.ADMIN)
  listAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.listAccess(id, actor(user));
  }

  @Post(':id/access')
  @Roles(Role.TEACHER, Role.ADMIN)
  grantAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantAccessDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.grantAccess(id, dto, actor(user));
  }

  @Delete(':id/access/:studentId')
  @Roles(Role.TEACHER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.revokeAccess(id, studentId, actor(user));
  }
}
