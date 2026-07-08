// ============================================================
//  SaveAnswerDto : enregistre la réponse d'UNE question.
//  Appelé à chaque sélection => sauvegarde automatique.
//  - selectedOptionId  : choix unique (SINGLE_CHOICE / TRUE_FALSE)
//  - selectedOptionIds : choix multiples (MULTIPLE_CHOICE)
//  L'un OU l'autre selon le type ; les deux sont optionnels ici,
//  la cohérence avec le type est vérifiée côté service.
// ============================================================
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SaveAnswerDto {
  @IsUUID(undefined, { message: 'questionId doit être un UUID valide.' })
  questionId: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'selectedOptionId doit être un UUID valide.' })
  selectedOptionId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, {
    each: true,
    message: 'selectedOptionIds doit contenir des UUID valides.',
  })
  selectedOptionIds?: string[];

  // Réponse libre (SHORT_ANSWER).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  text?: string;
}
