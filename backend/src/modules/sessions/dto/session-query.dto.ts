// ============================================================
//  SessionQueryDto : pagination + filtres (examen, statut).
// ============================================================
import { SessionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class SessionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  examId?: string;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}
