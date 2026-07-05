// ============================================================
//  UpdateEvaluationDto : mise à jour de la config (pas le code,
//  pas la matière, pas la composition — endpoints dédiés).
// ============================================================
import {
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

export class UpdateEvaluationDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() academicSessionId?: string;
  @IsOptional() @IsInt() @Min(1) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) passScore?: number;
  @IsOptional() @IsInt() @Min(1) maxScore?: number;
  @IsOptional() @IsInt() @Min(0) extraTimeMinutes?: number;
  @IsOptional() @IsInt() @Min(1) attemptsAllowed?: number;
  @IsOptional() @IsBoolean() randomizeQuestions?: boolean;
  @IsOptional() @IsBoolean() oneQuestionAtATime?: boolean;
  @IsOptional() @IsBoolean() shuffleAnswers?: boolean;
  @IsOptional() @IsBoolean() showResultImmediately?: boolean;
  @IsOptional() @IsBoolean() autoGrade?: boolean;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsUUID() groupId?: string;
}
