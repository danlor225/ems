// ============================================================
//  AcademicSessionsService : CRUD des sessions académiques.
// ============================================================
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { UpdateAcademicSessionDto } from './dto/update-academic-session.dto';

@Injectable()
export class AcademicSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertWindow(start: Date, end: Date): void {
    if (end <= start) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début.',
      );
    }
  }

  create(dto: CreateAcademicSessionDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.assertWindow(startDate, endDate);
    return this.prisma.academicSession.create({
      data: {
        name: dto.name,
        academicYear: dto.academicYear,
        startDate,
        endDate,
        description: dto.description,
      },
    });
  }

  async findAll(query: PaginationQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.academicSession.findMany({
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.academicSession.count(),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const session = await this.prisma.academicSession.findUnique({
      where: { id },
    });
    if (!session) {
      throw new NotFoundException('Session académique introuvable.');
    }
    return session;
  }

  async update(id: string, dto: UpdateAcademicSessionDto) {
    const current = await this.findOne(id);
    const startDate = dto.startDate ? new Date(dto.startDate) : current.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : current.endDate;
    this.assertWindow(startDate, endDate);
    return this.prisma.academicSession.update({
      where: { id },
      data: {
        name: dto.name,
        academicYear: dto.academicYear,
        description: dto.description,
        startDate,
        endDate,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    // onDelete: SetNull côté évaluations => pas de blocage.
    await this.prisma.academicSession.delete({ where: { id } });
  }
}
