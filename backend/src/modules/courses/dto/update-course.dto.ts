// ============================================================
//  UpdateCourseDto : mise à jour PARTIELLE d'un cours.
//  PartialType rend tous les champs de CreateCourseDto optionnels
//  (règles de validation conservées).
//
//  Cas des ressources : si `resources` est fourni, le service REMPLACE
//  l'intégralité des ressources du cours (suppression + recréation en
//  transaction). Si `resources` est absent, elles sont inchangées.
// ============================================================
import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseDto } from './create-course.dto';

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
