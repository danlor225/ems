// ============================================================
//  CreateAnswerOptionDto : une option de réponse d'une question.
// ============================================================
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class CreateAnswerOptionDto {
  @IsString()
  @IsNotEmpty({ message: 'Le texte de la réponse est requis.' })
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}
