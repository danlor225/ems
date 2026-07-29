// ============================================================
//  CreateCourseResourceDto : un support unitaire d'un cours
//  (un document OU une vidéo). L'`url` peut être un lien externe
//  (YouTube, Drive…) ou, en Phase D, un fichier téléversé.
// ============================================================
import { CourseResourceType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCourseResourceDto {
  @IsEnum(CourseResourceType, {
    message: 'Le type doit être DOCUMENT ou VIDEO.',
  })
  type: CourseResourceType;

  @IsString()
  @IsNotEmpty({ message: 'Le titre de la ressource est requis.' })
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty({ message: "L'URL de la ressource est requise." })
  @MaxLength(2048)
  url: string;

  // Ordre d'affichage dans le cours (0 par défaut, borné côté service).
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
