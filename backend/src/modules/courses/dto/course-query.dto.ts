// ============================================================
//  CourseQueryDto : filtres de la liste des cours.
//  Hérite de la pagination (?page&limit) + filtre optionnel par
//  matière (?subjectId=...).
// ============================================================
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CourseQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'subjectId doit être un UUID valide.' })
  subjectId?: string;
}
