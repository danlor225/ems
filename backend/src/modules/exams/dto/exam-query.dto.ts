// ============================================================
//  ExamQueryDto : pagination + filtre optionnel par matière.
// ============================================================
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ExamQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
