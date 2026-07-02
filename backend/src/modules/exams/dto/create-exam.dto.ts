// ============================================================
//  CreateExamDto : un examen (modèle) + sa composition de questions.
//  On limite la composition à 20 max ici ; le minimum de 15 est
//  contrôlé à la PUBLICATION (on peut construire un brouillon).
// ============================================================
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre est requis.' })
  @MaxLength(200)
  title: string;

  @IsUUID(undefined, { message: 'subjectId doit être un UUID valide.' })
  subjectId: string;

  @IsInt()
  @Min(1, { message: 'La durée doit être d’au moins 1 minute.' })
  durationMinutes: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passScore?: number; // seuil de réussite en % (défaut 50)

  @IsArray()
  @ArrayMinSize(1, { message: 'Ajoutez au moins une question.' })
  @ArrayMaxSize(20, { message: 'Un examen ne peut dépasser 20 questions.' })
  @IsUUID(undefined, { each: true })
  questionIds: string[];
}
