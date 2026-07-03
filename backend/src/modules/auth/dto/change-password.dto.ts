// ============================================================
//  ChangePasswordDto : changement de mot de passe.
// ============================================================
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est requis.' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(72)
  newPassword: string;
}
