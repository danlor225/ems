// ============================================================
//  CreateSessionDto : planifie une session pour un examen publié.
//  @IsISO8601 valide un format de date ISO (ex: 2026-07-10T09:00:00Z).
//  La cohérence (closesAt > opensAt, futur) est vérifiée côté service.
// ============================================================
import { IsISO8601, IsUUID } from 'class-validator';

export class CreateSessionDto {
  @IsUUID(undefined, { message: 'examId doit être un UUID valide.' })
  examId: string;

  @IsISO8601({}, { message: 'opensAt doit être une date ISO valide.' })
  opensAt: string;

  @IsISO8601({}, { message: 'closesAt doit être une date ISO valide.' })
  closesAt: string;
}
