// ============================================================
//  CreateSubjectDto : données pour créer une matière.
// ============================================================
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la matière est requis.' })
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
