// ============================================================
//  RefreshTokenDto : le refresh token envoyé par le client
//  pour /auth/refresh et /auth/logout.
//  (En production, on le transmettrait plutôt via un cookie
//   httpOnly ; on utilise le corps de requête ici pour la
//   simplicité d'apprentissage et de test.)
// ============================================================
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Le refresh token est requis.' })
  refreshToken: string;
}
