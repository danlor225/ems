// ============================================================
//  ResultQueryDto : pagination + filtres des résultats (staff).
// ============================================================
import { AttemptStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ResultQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  examId?: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsEnum(AttemptStatus)
  status?: AttemptStatus;
}
