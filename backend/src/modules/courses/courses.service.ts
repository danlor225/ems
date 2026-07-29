// ============================================================
//  CoursesService : logique métier + accès données des cours.
//  - Visibilité : les étudiants ne voient que les cours publiés.
//  - Propriété : un non-ADMIN ne modifie/supprime que ses propres cours.
//  - Ressources : remplacées en bloc lors d'une mise à jour (transaction).
// ============================================================
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { unlink } from 'fs/promises';
import { PrismaService } from '../../prisma/prisma.service';
import { CourseQueryDto } from './dto/course-query.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateCourseResourceDto } from './dto/create-course-resource.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import {
  FILES_ROUTE,
  UPLOAD_RULES,
  type UploadKind,
} from './upload.config';

// Acteur = qui agit (extrait du JWT) : sert aux règles de propriété et,
// pour un étudiant, au filtrage des cours réservés à son groupe.
type Actor = { id: string; role: Role; groupId?: string | null };

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Normalise les ressources : garantit un `order` (index si absent). */
  private toResourceData(resources: CreateCourseResourceDto[] = []) {
    return resources.map((r, i) => ({
      type: r.type,
      title: r.title,
      url: r.url,
      order: r.order ?? i,
    }));
  }

  /** Crée un cours (avec ses ressources) au nom de l'auteur connecté. */
  async create(dto: CreateCourseDto, actor: Actor) {
    try {
      const isPaid = dto.isPaid ?? false;
      return await this.prisma.course.create({
        data: {
          subjectId: dto.subjectId,
          title: dto.title,
          description: dto.description,
          isPublished: dto.isPublished ?? false,
          isPaid,
          // Un cours gratuit a toujours un prix nul (cohérence garantie ici).
          price: isPaid ? (dto.price ?? 0) : 0,
          // null/absent => cours public ; sinon réservé à ce groupe.
          groupId: dto.groupId ?? null,
          authorId: actor.id,
          resources: { create: this.toResourceData(dto.resources) },
        },
        include: { resources: { orderBy: { order: 'asc' } } },
      });
    } catch (error) {
      // P2003 = FK invalide : matière OU groupe référencé inexistant.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('Matière ou groupe introuvable.');
      }
      throw error;
    }
  }

  /**
   * Liste paginée. Les étudiants ne voient que les cours publiés ;
   * le staff (TEACHER/ADMIN) voit tout. Filtre optionnel par matière.
   */
  async findAll(query: CourseQueryDto, viewer: Actor) {
    const { page, limit, subjectId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = {
      ...(subjectId ? { subjectId } : {}),
      ...(viewer.role === Role.STUDENT
        ? {
            isPublished: true,
            // Cours public (groupId null) OU réservé au groupe de l'étudiant.
            // Un étudiant sans groupe ne voit que les cours publics.
            OR: viewer.groupId
              ? [{ groupId: null }, { groupId: viewer.groupId }]
              : [{ groupId: null }],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subject: { select: { id: true, name: true } },
          author: { select: { id: true, firstName: true, lastName: true } },
          group: { select: { id: true, name: true } },
          _count: { select: { resources: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Détail d'un cours + ses ressources ordonnées. Un étudiant ne peut
   * pas ouvrir un cours non publié (404 pour ne rien divulguer).
   */
  async findOne(id: string, viewer: Actor) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true } },
        author: { select: { id: true, firstName: true, lastName: true } },
        group: { select: { id: true, name: true } },
        resources: { orderBy: { order: 'asc' } },
      },
    });

    const isStudent = viewer.role === Role.STUDENT;

    // Un étudiant ne peut ouvrir ni un brouillon, ni un cours réservé à un
    // AUTRE groupe que le sien (404 pour ne rien divulguer).
    const wrongGroup =
      isStudent && course?.groupId && course.groupId !== viewer.groupId;
    if (!course || (isStudent && !course.isPublished) || wrongGroup) {
      throw new NotFoundException('Cours introuvable.');
    }

    // Verrouillage payant : un étudiant sans accès voit le cours mais PAS
    // ses ressources. Le staff a toujours accès.
    const hasAccess =
      !isStudent ||
      !course.isPaid ||
      (await this.hasStudentAccess(course.id, viewer.id));

    // Présence auto-déclarée de l'étudiant courant (pour l'affichage).
    const myAttendance = isStudent
      ? await this.prisma.courseAttendance.findUnique({
          where: {
            courseId_studentId: { courseId: course.id, studentId: viewer.id },
          },
          select: { markedAt: true },
        })
      : null;

    return {
      ...course,
      resources: hasAccess ? course.resources : [],
      hasAccess,
      locked: !hasAccess,
      myAttendanceAt: myAttendance?.markedAt ?? null,
    };
  }

  /** Vrai si l'étudiant possède un accès (inscription/paiement) au cours. */
  private async hasStudentAccess(courseId: string, studentId: string) {
    const access = await this.prisma.courseAccess.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
      select: { id: true },
    });
    return access !== null;
  }

  /**
   * Mise à jour. Vérifie la propriété (non-ADMIN => son propre cours).
   * Si `resources` est fourni, remplace TOUTES les ressources en une
   * seule transaction (suppression + recréation).
   */
  async update(id: string, dto: UpdateCourseDto, actor: Actor) {
    const course = await this.assertCanManage(id, actor);

    const { resources, ...scalars } = dto;

    // Cas simple : pas de ressources fournies => on ne touche qu'aux champs.
    if (resources === undefined) {
      return this.prisma.course.update({
        where: { id: course.id },
        data: scalars,
        include: { resources: { orderBy: { order: 'asc' } } },
      });
    }

    // Cas avec ressources : opération atomique (tout ou rien).
    return this.prisma.$transaction(async (tx) => {
      await tx.courseResource.deleteMany({ where: { courseId: course.id } });
      return tx.course.update({
        where: { id: course.id },
        data: {
          ...scalars,
          resources: { create: this.toResourceData(resources) },
        },
        include: { resources: { orderBy: { order: 'asc' } } },
      });
    });
  }

  /** Suppression (les ressources partent en cascade via le schéma). */
  async remove(id: string, actor: Actor): Promise<void> {
    const course = await this.assertCanManage(id, actor);
    await this.prisma.course.delete({ where: { id: course.id } });
  }

  /**
   * Traite un fichier téléversé (multer l'a déjà écrit sur le disque).
   * Vérifie la taille selon le type, puis renvoie l'URL publique du
   * fichier (à réutiliser comme `url` d'une ressource).
   */
  async handleUpload(file: Express.Multer.File | undefined, type: string) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    const kind = String(type).toUpperCase() as UploadKind;
    const rule = UPLOAD_RULES[kind];
    // Type déjà filtré par multer, mais on reste défensif.
    if (!rule) {
      await this.safeUnlink(file.path);
      throw new BadRequestException('Type de ressource invalide.');
    }
    // Borne fine par type (multer n'applique que le plafond global).
    if (file.size > rule.maxBytes) {
      await this.safeUnlink(file.path);
      const maxMo = Math.round(rule.maxBytes / (1024 * 1024));
      throw new BadRequestException(
        `Fichier trop volumineux (maximum ${maxMo} Mo pour un ${kind}).`,
      );
    }
    return {
      url: `${FILES_ROUTE}/${file.filename}`,
      title: file.originalname,
    };
  }

  /** Supprime un fichier sans échouer s'il a déjà disparu. */
  private async safeUnlink(path: string) {
    try {
      await unlink(path);
    } catch {
      // fichier absent : on ignore.
    }
  }

  /**
   * Garantit que le cours existe (404) ET que l'acteur a le droit de le
   * gérer (403 si un non-ADMIN vise le cours d'un autre auteur).
   */
  private async assertCanManage(id: string, actor: Actor) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundException('Cours introuvable.');
    }
    if (
      actor.role !== Role.ADMIN &&
      course.authorId &&
      course.authorId !== actor.id
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez modifier que vos propres cours.",
      );
    }
    return course;
  }

  // ----------------------------------------------------------------
  //  PRÉSENCE (auto-déclarée par l'étudiant)
  // ----------------------------------------------------------------

  /**
   * L'étudiant se déclare présent. Idempotent : réappeler ne change pas
   * l'horodatage initial. Exige un cours publié et, s'il est payant, un
   * accès valide.
   */
  async markAttendance(courseId: string, student: Actor) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, isPublished: true, isPaid: true },
    });
    if (!course || !course.isPublished) {
      throw new NotFoundException('Cours introuvable.');
    }
    if (
      course.isPaid &&
      !(await this.hasStudentAccess(courseId, student.id))
    ) {
      throw new ForbiddenException(
        'Accès requis : ce cours est payant.',
      );
    }
    const record = await this.prisma.courseAttendance.upsert({
      where: {
        courseId_studentId: { courseId, studentId: student.id },
      },
      create: { courseId, studentId: student.id },
      update: {}, // idempotent : on conserve le premier markedAt
      select: { markedAt: true },
    });
    return { markedAt: record.markedAt };
  }

  /** Feuille de présence d'un cours (staff propriétaire/admin). */
  async listAttendance(courseId: string, actor: Actor) {
    await this.assertCanManage(courseId, actor);
    const rows = await this.prisma.courseAttendance.findMany({
      where: { courseId },
      orderBy: { markedAt: 'asc' },
      select: {
        markedAt: true,
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return rows.map((r) => ({ ...r.student, markedAt: r.markedAt }));
  }

  // ----------------------------------------------------------------
  //  ACCÈS (cours payants) — inscription manuelle par le staff
  // ----------------------------------------------------------------

  /**
   * Accorde à un étudiant l'accès à un cours (simule l'achat). La cible
   * est identifiée par son id OU son email.
   */
  async grantAccess(
    courseId: string,
    target: { studentId?: string; email?: string },
    actor: Actor,
  ) {
    await this.assertCanManage(courseId, actor);

    if (!target.studentId && !target.email) {
      throw new BadRequestException('Fournissez un email ou un identifiant.');
    }

    // La cible doit être un étudiant existant (résolu par id ou email).
    const student = await this.prisma.user.findFirst({
      where: target.studentId
        ? { id: target.studentId }
        : { email: target.email!.toLowerCase().trim() },
      select: { id: true, role: true },
    });
    if (!student || student.role !== Role.STUDENT) {
      throw new BadRequestException('Étudiant introuvable.');
    }

    return this.prisma.courseAccess.upsert({
      where: {
        courseId_studentId: { courseId, studentId: student.id },
      },
      create: {
        courseId,
        studentId: student.id,
        source: 'MANUAL',
        grantedById: actor.id,
      },
      update: {}, // déjà accordé : sans effet
      select: { id: true, courseId: true, studentId: true, createdAt: true },
    });
  }

  /** Retire l'accès d'un étudiant à un cours. */
  async revokeAccess(
    courseId: string,
    studentId: string,
    actor: Actor,
  ): Promise<void> {
    await this.assertCanManage(courseId, actor);
    await this.prisma.courseAccess.deleteMany({
      where: { courseId, studentId },
    });
  }

  /** Liste des étudiants ayant accès à un cours (staff). */
  async listAccess(courseId: string, actor: Actor) {
    await this.assertCanManage(courseId, actor);
    const rows = await this.prisma.courseAccess.findMany({
      where: { courseId },
      orderBy: { createdAt: 'asc' },
      select: {
        source: true,
        createdAt: true,
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return rows.map((r) => ({
      ...r.student,
      source: r.source,
      grantedAt: r.createdAt,
    }));
  }
}
