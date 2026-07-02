// ============================================================
//  @CurrentUser() : récupère l'utilisateur authentifié attaché
//  à la requête par la JwtStrategy (request.user).
//  Évite d'écrire `@Req() req` puis `req.user` partout (DRY + lisibilité).
// ============================================================
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SafeUser } from '../../modules/auth/auth.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SafeUser => {
    const request = ctx.switchToHttp().getRequest<{ user: SafeUser }>();
    return request.user;
  },
);
