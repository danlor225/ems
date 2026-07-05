import { EvaluationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class EvaluationQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(EvaluationStatus) status?: EvaluationStatus;
  @IsOptional() @IsUUID() subjectId?: string;
  @IsOptional() @IsUUID() academicSessionId?: string;
  @IsOptional() @IsString() search?: string;
}
