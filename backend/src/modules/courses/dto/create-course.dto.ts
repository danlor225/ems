// ============================================================
//  CreateCourseDto : un cours + (optionnellement) ses ressources.
//  @ValidateNested + @Type => valide CHAQUE ressource du tableau.
// ============================================================
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateCourseResourceDto } from './create-course-resource.dto';

export class CreateCourseDto {
  @IsUUID(undefined, { message: 'subjectId doit être un UUID valide.' })
  subjectId: string;

  @IsString()
  @IsNotEmpty({ message: 'Le titre du cours est requis.' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Brouillon par défaut : un cours n'est visible des étudiants qu'une
  // fois publié (isPublished = true).
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  // Monétisation. isPaid = true => contenu verrouillé pour les étudiants
  // sans accès. price en FCFA (entier, >= 0). Ignoré/mis à 0 si gratuit.
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Le prix doit être positif (FCFA).' })
  price?: number;

  // Ressources fournies à la création (0..n). Optionnel : on peut créer
  // un cours vide puis lui ajouter des supports ensuite.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCourseResourceDto)
  resources?: CreateCourseResourceDto[];
}
