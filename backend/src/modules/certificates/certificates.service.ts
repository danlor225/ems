// ============================================================
//  CertificatesService : émission & vérification des certificats
//  de réussite. On stocke un SNAPSHOT immuable à l'émission :
//  le certificat reste vérifiable quoi qu'il arrive ensuite.
// ============================================================
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CertificateQueryDto } from './dto/certificate-query.dto';

interface Actor {
  id: string;
}

// Champs renvoyés dans la liste staff (le snapshot complet sauf technique).
const LIST_SELECT = {
  id: true,
  code: true,
  studentName: true,
  studentEmail: true,
  matricule: true,
  className: true,
  evaluationTitle: true,
  subjectName: true,
  note: true,
  totalPoints: true,
  mention: true,
  issuedAt: true,
  revokedAt: true,
} satisfies Prisma.CertificateSelect;

function mentionOf(pct: number): string {
  if (pct >= 80) return 'Très Bien';
  if (pct >= 60) return 'Bien';
  if (pct >= 50) return 'Passable';
  return 'Mauvais';
}

@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Émet un certificat pour UNE tentative réussie (idempotent). */
  async issueForAttempt(attemptId: string, actor: Actor) {
    const existing = await this.prisma.certificate.findUnique({
      where: { attemptId },
      select: LIST_SELECT,
    });
    if (existing) return existing; // déjà émis : on renvoie l'existant

    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            matricule: true,
            group: { select: { name: true } },
          },
        },
        session: {
          include: {
            exam: {
              select: {
                title: true,
                passScore: true,
                subject: { select: { name: true } },
                examQuestions: {
                  select: { question: { select: { points: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Tentative introuvable.');
    if (attempt.status !== 'SUBMITTED' && attempt.status !== 'EXPIRED') {
      throw new ConflictException('La tentative n’est pas terminée.');
    }

    const exam = attempt.session.exam;
    const totalPoints = exam.examQuestions.reduce(
      (sum, eq) => sum + eq.question.points,
      0,
    );
    const note = attempt.score ?? 0;
    const percentage = totalPoints > 0 ? (note / totalPoints) * 100 : 0;
    if (percentage < exam.passScore) {
      throw new ConflictException(
        'Tentative non réussie : aucun certificat ne peut être émis.',
      );
    }

    // Seuils fixes 80/60/50 (cohérents avec Résultats/Dashboard), MAIS un
    // certificat de réussite ne doit jamais porter la mention "Mauvais" :
    // si le passScore est < 50, on plancher la mention à "Passable".
    const rawMention = mentionOf(percentage);
    const mention = rawMention === 'Mauvais' ? 'Passable' : rawMention;

    const code = await this.generateCode();
    return this.prisma.certificate.create({
      data: {
        code,
        attemptId,
        studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
        studentEmail: attempt.student.email,
        matricule: attempt.student.matricule,
        className: attempt.student.group?.name ?? null,
        evaluationTitle: exam.title,
        subjectName: exam.subject?.name ?? null,
        note,
        totalPoints,
        mention,
        issuedById: actor.id,
      },
      select: LIST_SELECT,
    });
  }

  /** Émission groupée : tous les admis d'une évaluation sans certificat. */
  async issueForEvaluation(evaluationId: string, actor: Actor) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: evaluationId },
      select: { id: true },
    });
    if (!exam) throw new NotFoundException('Évaluation introuvable.');

    const attempts = await this.prisma.attempt.findMany({
      where: {
        session: { examId: evaluationId },
        status: { in: ['SUBMITTED', 'EXPIRED'] },
        certificate: null, // pas encore de certificat
      },
      select: { id: true },
    });

    let issued = 0;
    let skipped = 0;
    for (const a of attempts) {
      try {
        await this.issueForAttempt(a.id, actor);
        issued++;
      } catch (error) {
        // Tentative non réussie => on ignore, on ne bloque pas le lot.
        if (error instanceof ConflictException) skipped++;
        else throw error;
      }
    }
    return { issued, skipped, candidates: attempts.length };
  }

  /** Liste paginée / filtrable (staff). */
  async findAll(query: CertificateQueryDto) {
    const { page, limit, search, evaluationId, status } = query;
    const where: Prisma.CertificateWhereInput = {
      ...(status === 'valid' ? { revokedAt: null } : {}),
      ...(status === 'revoked' ? { revokedAt: { not: null } } : {}),
      ...(evaluationId
        ? { attempt: { session: { examId: evaluationId } } }
        : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { studentName: { contains: search, mode: 'insensitive' } },
              { matricule: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.certificate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issuedAt: 'desc' },
        select: LIST_SELECT,
      }),
      this.prisma.certificate.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Révocation (idempotente) : marque le certificat invalide. */
  async revoke(id: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!cert) throw new NotFoundException('Certificat introuvable.');
    return this.prisma.certificate.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: LIST_SELECT,
    });
  }

  /**
   * Vérification PUBLIQUE par code (aucune donnée sensible : ni email,
   * ni id technique). Ne lève pas 404 : renvoie found=false pour ne pas
   * distinguer "inexistant" côté attaquant.
   */
  async verify(code: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { code },
      select: {
        code: true,
        studentName: true,
        matricule: true,
        className: true,
        evaluationTitle: true,
        subjectName: true,
        note: true,
        totalPoints: true,
        mention: true,
        issuedAt: true,
        revokedAt: true,
      },
    });
    if (!cert) return { found: false as const };
    const { revokedAt, ...rest } = cert;
    return {
      found: true as const,
      valid: revokedAt === null,
      revokedAt,
      certificate: rest,
    };
  }

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CERT-${year}-`;
    const count = await this.prisma.certificate.count({
      where: { code: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}
