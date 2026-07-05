// ============================================================
//  EvaluationsController : /api/evaluations (staff).
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { SafeUser } from '../auth/auth.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { EvaluationQueryDto } from './dto/evaluation-query.dto';
import { PublishEvaluationDto } from './dto/publish-evaluation.dto';
import { SetQuestionsDto } from './dto/set-questions.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { EvaluationsService } from './evaluations.service';

function actor(user: SafeUser) {
  return { id: user.id, role: user.role };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly service: EvaluationsService) {}

  @Post()
  create(@Body() dto: CreateEvaluationDto, @CurrentUser() user: SafeUser) {
    return this.service.create(dto, actor(user));
  }

  @Get()
  findAll(@Query() query: EvaluationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/summary')
  summary(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.summary(id, actor(user));
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.update(id, dto, actor(user));
  }

  @Patch(':id/questions')
  setQuestions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetQuestionsDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.setQuestions(id, dto.questionIds, actor(user));
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishEvaluationDto,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.publish(id, dto, actor(user));
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.close(id, actor(user));
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.archive(id, actor(user));
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.service.duplicate(id, actor(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.remove(id, actor(user));
  }
}
