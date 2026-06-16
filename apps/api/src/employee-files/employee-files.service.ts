import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeFileDto } from './dto/create-employee-file.dto';

@Injectable()
export class EmployeeFilesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateEmployeeFileDto) {
    const employee = await this.prisma.empleado.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    return this.prisma.employeeFile.create({
      data: { ...dto, tenantId },
    });
  }

  async findByEmployee(tenantId: string, employeeId: string) {
    const employee = await this.prisma.empleado.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    const files = await this.prisma.employeeFile.findMany({
      where: { tenantId, employeeId },
      orderBy: { createdAt: 'desc' },
      include: {
        generatedDocument: { select: { id: true, nombre: true, tipo: true } },
      },
    });

    const stats = await this.buildStats(tenantId, employeeId);

    return { files, stats };
  }

  async findOne(tenantId: string, id: string) {
    const file = await this.prisma.employeeFile.findFirst({
      where: { id, tenantId },
      include: {
        employee: { select: { id: true, nombre: true, apellido: true } },
        generatedDocument: { select: { id: true, nombre: true, tipo: true } },
      },
    });
    if (!file)
      throw new NotFoundException('Archivo no encontrado en el expediente');
    return file;
  }

  async remove(tenantId: string, id: string) {
    const file = await this.findOne(tenantId, id);
    return this.prisma.employeeFile.delete({ where: { id: file.id } });
  }

  async createFromGeneratedDoc(
    tenantId: string,
    generatedDocId: string,
    employeeId: string,
    nombre: string,
    pdfUrl: string,
    tipo: string,
  ) {
    const categoryMap: Record<string, string> = {
      CONTRACT: 'CONTRACT',
      CERTIFICATION: 'CERTIFICATION',
      MEMO: 'MEMO',
      LETTER: 'LETTER',
    };

    const categoria = (categoryMap[tipo] ?? 'OTHER') as
      | 'CONTRACT'
      | 'CERTIFICATION'
      | 'MEMO'
      | 'LETTER'
      | 'OTHER';

    return this.prisma.employeeFile.create({
      data: {
        tenantId,
        employeeId,
        generatedDocumentId: generatedDocId,
        nombre,
        categoria,
        archivoUrl: pdfUrl,
        mimeType: 'application/pdf',
      },
    });
  }

  private async buildStats(tenantId: string, employeeId: string) {
    const files = await this.prisma.employeeFile.findMany({
      where: { tenantId, employeeId },
      select: { categoria: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const byCategory: Record<string, number> = {};
    for (const f of files) {
      byCategory[f.categoria] = (byCategory[f.categoria] ?? 0) + 1;
    }

    return {
      total: files.length,
      byCategory,
      ultimoDocumento: files[0]?.createdAt?.toISOString() ?? null,
    };
  }
}
