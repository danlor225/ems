// ============================================================
//  UpdateQuestionDto : mise à jour d'une question.
//  Champs scalaires + options (optionnelles) : si `options` est
//  fourni, le service remplace intégralement le jeu de réponses.
//  isActive permet la désactivation "soft-delete".
// ============================================================
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateAnswerOptionDto } from './create-answer-option.dto';

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

  // Optionnel : si présent, remplace TOUTES les options de la question.
  // Les règles par type (nb d'options, nb de bonnes réponses) sont
  // vérifiées côté service selon le type ACTUEL de la question.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Une question doit avoir au moins une réponse.' })
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerOptionDto)
  options?: CreateAnswerOptionDto[];
}
