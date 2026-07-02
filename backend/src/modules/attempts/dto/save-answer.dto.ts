// ============================================================
//  SaveAnswerDto : enregistre la réponse d'UNE question.
//  Appelé à chaque sélection => sauvegarde automatique.
// ============================================================
import { IsUUID } from 'class-validator';

export class SaveAnswerDto {
  @IsUUID(undefined, { message: 'questionId doit être un UUID valide.' })
  questionId: string;

  @IsUUID(undefined, { message: 'selectedOptionId doit être un UUID valide.' })
  selectedOptionId: string;
}
