// ============================================================
//  CreateAcademicSessionDto : conteneur académique (année/période).
// ============================================================
import {
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAcademicSessionDto {
  @IsString()
  @MinLength(1, { message: 'Le nom est requis.' })
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(1, { message: "L'année académique est requise." })
  academicYear: string;

  @IsISO8601({}, { message: 'Date de début invalide.' })
  startDate: string;

  @IsISO8601({}, { message: 'Date de fin invalide.' })
  endDate: string;

  @IsOptional()
  @IsString()
  description?: string;
}
