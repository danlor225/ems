// ============================================================
//  AuthService : logique d'authentification.
//  - register : création de compte (hachage bcrypt)
//  - login    : vérification + émission access/refresh tokens
//  - refresh  : rotation du refresh token + nouvel access token
//  - logout   : révocation du refresh token
// ============================================================
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RefreshTokenService } from './refresh-token.service';

// Coût du hachage bcrypt (compromis sécurité/performance).
const BCRYPT_SALT_ROUNDS = 12;

// Hash "leurre" pour égaliser le temps de réponse quand l'email n'existe pas.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_SALT_ROUNDS);

// Un utilisateur SANS son hash de mot de passe.
export type SafeUser = Omit<User, 'passwordHash'>;

// La paire de jetons renvoyée au client.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Contenu attendu dans un refresh token.
interface RefreshPayload {
  sub: string; // id de l'utilisateur
  jti: string; // id du refresh token en base (JWT ID)
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  /** Inscription (rôle STUDENT par défaut). */
  async register(dto: RegisterDto): Promise<SafeUser> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      const user = await this.usersService.create({
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      return this.toSafeUser(user);
    } catch (error) {
      // La contrainte UNIQUE de la base est la source de vérité (défense en profondeur).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Un compte existe déjà avec cet email.');
      }
      throw error;
    }
  }

  /** Connexion : vérifie les identifiants, renvoie tokens + utilisateur "safe". */
  async login(
    dto: LoginDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<AuthTokens & { user: SafeUser }> {
    const user = await this.usersService.findByEmail(dto.email);

    // Comparaison systématique (anti-timing) contre un hash réel ou leurre.
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const passwordMatches = await bcrypt.compare(dto.password, hashToCompare);

    // Message générique (OWASP A07 - énumération de comptes).
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte est désactivé.');
    }
    if (user.isLocked) {
      throw new UnauthorizedException('Ce compte est verrouillé.');
    }

    const tokens = await this.issueTokenPair(user);
    // Journalisation de la connexion (best-effort, ne bloque pas le login).
    await this.usersService
      .recordLogin(user.id, meta?.ip, meta?.userAgent)
      .catch(() => undefined);
    return { ...tokens, user: this.toSafeUser(user) };
  }

  /** Échange un refresh token valide contre une NOUVELLE paire (rotation). */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const stored = await this.refreshTokens.findById(payload.jti);
    if (!stored) {
      throw new UnauthorizedException('Refresh token invalide.');
    }

    // Réutilisation d'un token DÉJÀ révoqué => probable vol => on coupe tout.
    if (stored.revoked) {
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Session compromise, reconnectez-vous.');
    }

    // Le token présenté doit correspondre au hash stocké.
    if (this.sha256(refreshToken) !== stored.tokenHash) {
      throw new UnauthorizedException('Refresh token invalide.');
    }

    // Rotation : on révoque l'ancien avant d'en émettre un nouveau.
    await this.refreshTokens.revoke(stored.id);

    const user = await this.usersService.findById(stored.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    return this.issueTokenPair(user);
  }

  /** Déconnexion : révoque le refresh token présenté (idempotent). */
  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.refreshTokens.revoke(payload.jti);
    } catch {
      // Un token déjà invalide/expiré ne provoque pas d'erreur : logout idempotent.
    }
  }

  /** Met à jour le profil (prénom / nom) et renvoie l'utilisateur "safe". */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    const user = await this.usersService.updateProfile(userId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    return this.toSafeUser(user);
  }

  /** Change le mot de passe après vérification de l'actuel. */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.usersService.updatePassword(userId, passwordHash);
  }

  // ------------------------------------------------------------
  //  Méthodes privées
  // ------------------------------------------------------------

  /** Émet un access token + un refresh token, et persiste ce dernier (haché). */
  private async issueTokenPair(user: User): Promise<AuthTokens> {
    const accessToken = await this.signAccessToken(user);

    // jti : identifiant unique du refresh token, embarqué dans le JWT ET
    // utilisé comme clé de la ligne en base (permet la révocation ciblée).
    const jti = randomUUID();
    const refreshToken = await this.signRefreshToken(user.id, jti);

    // On lit la date d'expiration directement depuis le JWT signé.
    const decoded = this.jwtService.decode(refreshToken) as { exp: number };

    await this.refreshTokens.create({
      id: jti,
      userId: user.id,
      tokenHash: this.sha256(refreshToken), // on ne stocke JAMAIS le token en clair
      expiresAt: new Date(decoded.exp * 1000),
    });

    return { accessToken, refreshToken };
  }

  /** Signe un access token (secret + durée d'accès par défaut du JwtModule). */
  private signAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.signAsync(payload);
  }

  /** Signe un refresh token avec le secret + la durée DÉDIÉS au refresh. */
  private signRefreshToken(userId: string, jti: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        // Cast sûr : la valeur est validée par Zod au démarrage.
        expiresIn: this.config.getOrThrow<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as JwtSignOptions['expiresIn'],
      },
    );
  }

  /** Vérifie signature + expiration d'un refresh token ; renvoie son payload. */
  private async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide.');
    }
  }

  /** Hash SHA-256 (hex) d'une chaîne. */
  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /** Retire le champ sensible `passwordHash`. */
  private toSafeUser(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
