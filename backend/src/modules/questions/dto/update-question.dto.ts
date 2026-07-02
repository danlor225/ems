// ============================================================
//  UpdateQuestionDto : mise à jour des champs SCALAIRES d'une
//  question (pas les options, gérées à la création).
//  isActive permet la désactivation "soft-delete".
// ============================================================
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateQuestionDto {
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  statement?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
