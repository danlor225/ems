// ============================================================
//  ActivityLogService : enregistre et consulte les actions sensibles.
//  Règle : journaliser ne doit JAMAIS faire échouer l'action métier
//  (les erreurs de log sont avalées).
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

interface LogParams {
  actorId?: string | null;
  action: string; // ex: 'EXAM_PUBLISHED'
  entity?: string; // ex: 'Exam'
  metadata?: Prisma.InputJsonValue; // contexte libre (ids, titres...)
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Enregistre un événement d'audit (best-effort). */
  async log(params: LogParams): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          actorId: params.actorId ?? null,
          action: params.action,
          entity: params.entity,
          metadata: params.metadata,
        },
      });
    } catch (error) {
      // On loggue en console mais on ne propage pas : l'action métier prime.
      this.logger.warn(`Échec de journalisation (${params.action}): ${error}`);
    }
  }

  /** Liste paginée des journaux (audit, ADMIN). */
  async findAll(query: PaginationQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.activityLog.count(),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
