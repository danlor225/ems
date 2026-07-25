// ============================================================
//  SessionsService : planification et disponibilité des sessions.
// ============================================================
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExamsService } from '../exams/exams.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examsService: ExamsService,
  ) {}

  /** Crée une session pour un examen publié, avec fenêtre temporelle cohérente. */
  async create(dto: CreateSessionDto) {
    // Réutilisation d'ExamsService : l'examen doit exister ET être publié.
    await this.examsService.assertPublishedExists(dto.examId);

    const opensAt = new Date(dto.opensAt);
    const closesAt = new Date(dto.closesAt);
    this.assertValidWindow(opensAt, closesAt);

    return this.prisma.session.create({
      data: { examId: dto.examId, opensAt, closesAt },
    });
  }

  /** Liste paginée, filtrable par examen et par statut. */
  async findAll(query: SessionQueryDto) {
    const { page, limit, examId, status } = query;
    const where: Prisma.SessionWhereInput = {
      ...(examId ? { examId } : {}),
      ...(status ? { status } : {}),
    };
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.session.findMany({
        where,
        skip,
        take: limit,
        orderBy: { opensAt: 'desc' },
        include: { exam: { select: { id: true, title: true } } },
      }),
      this.prisma.session.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Sessions ACTUELLEMENT ouvertes (vue étudiant).
   * Le serveur fait autorité : on compare à SA propre horloge.
   */
  findAvailable() {
    const now = new Date();
    return this.prisma.session.findMany({
      where: {
        status: { not: 'CLOSED' },
        opensAt: { lte: now },
        closesAt: { gte: now },
        exam: { isPublished: true },
      },
      orderBy: { closesAt: 'asc' },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            durationMinutes: true,
            subjectId: true,
            // Nombre de questions composant l'examen (sans les charger).
            _count: { select: { examQuestions: true } },
          },
        },
      },
    });
  }

  /**
   * Charge une session avec son examen et toute la composition
   * (questions + options). Utilisé par AttemptsService pour démarrer
   * une tentative. Lève 404 si absente.
   */
  async findWithComposition(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        exam: {
          include: {
            examQuestions: {
              orderBy: { order: 'asc' },
              include: { question: { include: { options: true } } },
            },
          },
        },
      },
    });
    if (!session) {
      throw new NotFoundException('Session introuvable.');
    }
    return session;
  }

  /** Détail (404 si absente). */
  async findOne(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { exam: { select: { id: true, title: true } } },
    });
    if (!session) {
      throw new NotFoundException('Session introuvable.');
    }
    return session;
  }

  /** Replanifie la fenêtre (garde les valeurs existantes si non fournies). */
  async update(id: string, dto: UpdateSessionDto) {
    const session = await this.findOne(id);
    const opensAt = dto.opensAt ? new Date(dto.opensAt) : session.opensAt;
    const closesAt = dto.closesAt ? new Date(dto.closesAt) : session.closesAt;
    this.assertValidWindow(opensAt, closesAt);

    return this.prisma.session.update({
      where: { id },
      data: { opensAt, closesAt },
    });
  }

  /** Ferme manuellement une session. */
  async close(id: string) {
    await this.findOne(id);
    return this.prisma.session.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }

  /** Suppression (404 si absente, 409 si des tentatives y sont rattachées). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    try {
      await this.prisma.session.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Session comportant des tentatives : suppression impossible.',
        );
      }
      throw error;
    }
  }

  /** closesAt doit être après opensAt et dans le futur. */
  private assertValidWindow(opensAt: Date, closesAt: Date): void {
    if (closesAt <= opensAt) {
      throw new BadRequestException(
        'La date de fermeture doit être postérieure à la date d’ouverture.',
      );
    }
    if (closesAt <= new Date()) {
      throw new BadRequestException(
        'La date de fermeture doit être dans le futur.',
      );
    }
  }
}
