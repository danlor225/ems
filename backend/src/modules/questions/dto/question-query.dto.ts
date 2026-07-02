// ============================================================
//  QuestionQueryDto : pagination + filtre optionnel par matière.
//  Hérite de PaginationQueryDto (page, limit) et ajoute subjectId.
// ============================================================
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QuestionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
