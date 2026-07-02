// ============================================================
//  UpdateSubjectDto : mise à jour PARTIELLE d'une matière.
//  PartialType rend tous les champs de CreateSubjectDto optionnels
//  tout en conservant leurs règles de validation (DRY).
// ============================================================
import { PartialType } from '@nestjs/mapped-types';
import { CreateSubjectDto } from './create-subject.dto';

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}
