// ============================================================
//  CertificatesController : /api/certificates (staff).
//  Émission (une / groupée), liste, révocation.
// ============================================================
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CertificatesService } from './certificates.service';
import { CertificateQueryDto } from './dto/certificate-query.dto';
import { IssueCertificateDto } from './dto/issue-certificate.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get()
  findAll(@Query() query: CertificateQueryDto) {
    return this.certificatesService.findAll(query);
  }

  @Post()
  issue(@Body() dto: IssueCertificateDto, @CurrentUser() user: SafeUser) {
    return this.certificatesService.issueForAttempt(dto.attemptId, {
      id: user.id,
    });
  }

  @Post('evaluation/:evaluationId')
  issueForEvaluation(
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @CurrentUser() user: SafeUser,
  ) {
    return this.certificatesService.issueForEvaluation(evaluationId, {
      id: user.id,
    });
  }

  @Post(':id/revoke')
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.certificatesService.revoke(id);
  }
}
