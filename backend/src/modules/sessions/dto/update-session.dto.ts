// ============================================================
//  UpdateSessionDto : replanifier la fenêtre d'une session.
//  (On ne change pas l'examen d'une session : on en crée une autre.)
// ============================================================
import { IsISO8601, IsOptional } from 'class-validator';

export class UpdateSessionDto {
  @IsOptional()
  @IsISO8601()
  opensAt?: string;

  @IsOptional()
  @IsISO8601()
  closesAt?: string;
}
