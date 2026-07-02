// ============================================================
//  RegisterDto : décrit ET valide les données d'inscription.
//  Le ValidationPipe global (main.ts) applique ces règles
//  automatiquement AVANT que le contrôleur ne reçoive la requête.
//  => Aucune donnée non validée n'atteint la logique métier.
// ============================================================
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  // Email valide, normalisé en minuscules + sans espaces superflus.
  // La normalisation garantit l'unicité insensible à la casse (A@x == a@x).
  @IsEmail({}, { message: 'Email invalide.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  // Mot de passe : min 8 caractères ; max 72 (limite technique de bcrypt).
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(72, { message: 'Le mot de passe ne doit pas dépasser 72 caractères.' })
  password: string;

  @IsString()
  @MinLength(1, { message: 'Le prénom est requis.' })
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MinLength(1, { message: 'Le nom est requis.' })
  @MaxLength(100)
  lastName: string;
}
