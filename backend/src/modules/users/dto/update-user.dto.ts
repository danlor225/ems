import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) lastName?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() isActive?: boolean;

  // Matricule : chaîne (max 50) ou null pour l'effacer.
  @IsOptional() @IsString() @MaxLength(50) matricule?: string | null;

  // groupId : UUID d'un groupe, ou null pour retirer l'étudiant de son groupe.
  // ValidateIf : on ne lance @IsUUID que si la valeur n'est pas null.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  groupId?: string | null;
}
