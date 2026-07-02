// ============================================================
//  CreateQuestionDto : une question + ses options.
//  @ValidateNested + @Type => valide CHAQUE option du tableau.
//  @ArrayMinSize(2)       => au moins 2 choix.
//  (La règle "exactement une bonne réponse" est vérifiée côté service.)
// ============================================================
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @IsArray()
  @ArrayMinSize(2, { message: 'Une question doit avoir au moins 2 réponses.' })
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerOptionDto)
  options: CreateAnswerOptionDto[];
}
