import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CertificateQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() search?: string;

  // Filtre par évaluation (via la tentative liée).
  @IsOptional() @IsUUID() evaluationId?: string;

  @IsOptional() @IsIn(['valid', 'revoked']) status?: 'valid' | 'revoked';
}
