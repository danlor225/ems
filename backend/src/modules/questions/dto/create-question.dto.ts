// ============================================================
//  CreateQuestionDto : une question + ses options.
//  @ValidateNested + @Type => valide CHAQUE option du tableau.
//  @ArrayMinSize(2)       => au moins 2 choix.
//  (La règle "exactement une bonne réponse" est vérifiée côté service.)
// ============================================================
import { Type } from 'class-transformer';
import { QuestionType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateAnswerOptionDto } from './create-answer-option.dto';

export class CreateQuestionDto {
  @IsUUID(undefined, { message: 'subjectId doit être un UUID valide.' })
  subjectId: string;

  @IsString()
  @IsNotEmpty({ message: "L'énoncé de la question est requis." })
  statement: string;

  // Type de question (défaut : choix unique). Détermine les règles de validation.
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  // Minimum 1 (les QCM exigent 2 : vérifié par type côté service).
  @IsArray()
  @ArrayMinSize(1, { message: 'Une question doit avoir au moins une réponse.' })
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerOptionDto)
  options: CreateAnswerOptionDto[];
}
