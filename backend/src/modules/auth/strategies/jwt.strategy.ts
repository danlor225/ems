// ============================================================
//  JwtStrategy : décrit COMMENT valider un access token.
//  Passport l'exécute automatiquement quand une route est
//  protégée par JwtAuthGuard.
// ============================================================
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { SafeUser } from '../auth.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      // Où trouver le token : dans l'en-tête "Authorization: Bearer <token>".
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // false => un token expiré est refusé (comportement voulu).
      ignoreExpiration: false,
      // Le MÊME secret que pour signer : sinon la vérification échoue.
      // getOrThrow => renvoie un string garanti (l'env est validé au démarrage).
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Appelée UNIQUEMENT si la signature et l'expiration sont valides.
   * On recharge l'utilisateur en base : un compte désactivé/supprimé est
   * rejeté même si son token est encore techniquement valide.
   * La valeur retournée est attachée à `request.user`.
   */
  async validate(payload: JwtPayload): Promise<SafeUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
