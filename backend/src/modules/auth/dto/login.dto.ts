// ============================================================
//  LoginDto : données de connexion.
//  On valide juste la présence/forme ; on NE redit PAS les règles
//  de complexité du mot de passe (inutile et cela donnerait des
//  indices à un attaquant).
// ============================================================
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email invalide.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  password: string;
}
