// ============================================================
//  CreateEvaluationDto : création d'une évaluation (brouillon).
//  Le code est généré côté serveur (non fourni ici).
// ============================================================
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEvaluationDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis.' })
  @MaxLength(200)
  name: string;

  @IsUUID() subjectId: string;
  @IsUUID() academicSessionId: string;

  @IsOptional() @IsString() description?: string;

  @IsInt() @Min(1) durationMinutes: number;

  @IsOptional() @IsInt() @Min(0) @Max(100) passScore?: number; // score min de réussite
  @IsOptional() @IsInt() @Min(1) maxScore?: number;
  @IsOptional() @IsInt() @Min(0) extraTimeMinutes?: number;
  @IsOptional() @IsInt() @Min(1) attemptsAllowed?: number;

  @IsOptional() @IsBoolean() randomizeQuestions?: boolean;
  @IsOptional() @IsBoolean() oneQuestionAtATime?: boolean;
  @IsOptional() @IsBoolean() shuffleAnswers?: boolean;
  @IsOptional() @IsBoolean() showResultImmediately?: boolean;
  @IsOptional() @IsBoolean() autoGrade?: boolean;

  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsString() groupId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  questionIds?: string[];
}
