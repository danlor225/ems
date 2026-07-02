// ============================================================
//  PaginationQueryDto : paramètres de pagination réutilisables
//  pour TOUTES les listes (?page=1&limit=20).
//  @Type(() => Number) : convertit les paramètres d'URL (chaînes)
//  en nombres, grâce au ValidationPipe { transform: true }.
// ============================================================
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // borne haute : on n'autorise pas de demander 10 000 éléments d'un coup
  limit: number = 20;
}
