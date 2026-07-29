// ============================================================
//  GrantAccessDto : accorde à un étudiant l'accès à un cours payant
//  (inscription manuelle par le staff, en l'absence de passerelle).
//  On accepte l'identifiant OU l'email (plus pratique côté interface,
//  le staff ne connaissant pas l'UUID de l'étudiant).
// ============================================================
import { IsEmail, IsOptional, IsUUID } from 'class-validator';

export class GrantAccessDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'studentId doit être un UUID valide.' })
  studentId?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email invalide.' })
  email?: string;
}
