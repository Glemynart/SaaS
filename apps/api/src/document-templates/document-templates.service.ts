import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';
import { DocumentTemplateQueryDto } from './dto/document-template-query.dto';
import { DuplicateDocumentTemplateDto } from './dto/duplicate-document-template.dto';
import { Prisma } from '@prisma/client';

const DEFAULT_TEMPLATES = [
  {
    tipo: 'CONTRACT' as const,
    nombre: 'Contrato laboral estándar',
    descripcion:
      'Plantilla base para contratos laborales con cláusulas estándar',
    contenido: `<h2>CONTRATO INDIVIDUAL DE TRABAJO</h2><p>Entre <strong>{{EMPRESA}}</strong>, identificada con NIT <strong>{{NIT}}</strong>, y <strong>{{NOMBRE_COMPLETO}}</strong>, identificado(a) con <strong>{{DOCUMENTO}}</strong>, se celebra el presente contrato de trabajo regido por las siguientes cláusulas:</p><h3>PRIMERA: CARGO</h3><p>El trabajador desempeñará el cargo de <strong>{{CARGO}}</strong>.</p><h3>SEGUNDA: REMUNERACIÓN</h3><p>El empleador pagará al trabajador un salario mensual de <strong>{{SALARIO}}</strong>.</p><h3>TERCERA: TIPO DE CONTRATO</h3><p>El presente contrato es de tipo <strong>{{TIPO_CONTRATO}}</strong>.</p><h3>CUARTA: FECHA DE INGRESO</h3><p>El trabajador iniciará labores el <strong>{{FECHA_INGRESO}}</strong>.</p>`,
  },
  {
    tipo: 'CERTIFICATION' as const,
    nombre: 'Certificación laboral',
    descripcion:
      'Plantilla para certificar la vinculación laboral de un empleado',
    contenido: `<h2>CERTIFICACIÓN LABORAL</h2><p><strong>{{EMPRESA}}</strong>, identificada con NIT <strong>{{NIT}}</strong>, certifica que:</p><p><strong>{{NOMBRE_COMPLETO}}</strong>, identificado(a) con <strong>{{DOCUMENTO}}</strong>, labora en nuestra organización desde el <strong>{{FECHA_INGRESO}}</strong>, desempeñando el cargo de <strong>{{CARGO}}</strong>, con un tipo de contrato <strong>{{TIPO_CONTRATO}}</strong>.</p><p>Esta certificación se expide a solicitud del interesado.</p>`,
  },
  {
    tipo: 'LETTER' as const,
    nombre: 'Carta formal',
    descripcion: 'Plantilla para comunicaciones formales con empleados',
    contenido: `<h2>{{EMPRESA}}</h2><p>NIT: {{NIT}}</p><hr><p><strong>Para:</strong> {{NOMBRE_COMPLETO}}</p><p><strong>Documento:</strong> {{DOCUMENTO}}</p><p><strong>Cargo:</strong> {{CARGO}}</p><hr><p>Por medio de la presente, nos dirigimos a usted con el fin de comunicarle que, en relación con su contrato de tipo <strong>{{TIPO_CONTRATO}}</strong> vigente desde <strong>{{FECHA_INGRESO}}</strong>, se informa lo siguiente:</p><p>[Contenido de la comunicación]</p><p>Cordialmente,</p><p><strong>{{EMPRESA}}</strong></p>`,
  },
  {
    tipo: 'MEMO' as const,
    nombre: 'Memorando interno',
    descripcion: 'Plantilla para comunicaciones internas y circulares',
    contenido: `<h2>MEMORANDO INTERNO</h2><p><strong>Fecha:</strong> {{FECHA_INGRESO}}</p><p><strong>Para:</strong> {{NOMBRE_COMPLETO}} — {{CARGO}}</p><p><strong>De:</strong> {{EMPRESA}}</p><hr><h3>ASUNTO</h3><p>Por medio del presente memorando, se informa al colaborador identificado con <strong>{{DOCUMENTO}}</strong>, vinculado mediante contrato <strong>{{TIPO_CONTRATO}}</strong>, lo siguiente:</p><p>[Cuerpo del memorando]</p><p>Atentamente,</p><p><strong>{{EMPRESA}}</strong></p>`,
  },
];

@Injectable()
export class DocumentTemplatesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateDocumentTemplateDto) {
    return this.prisma.documentTemplate.create({
      data: { ...dto, tenantId },
    });
  }

  async findAll(tenantId: string, query: DocumentTemplateQueryDto) {
    const { page = 1, limit = 10, search, tipo } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentTemplateWhereInput = {
      tenantId,
      deletedAt: null,
      ...(tipo && { tipo }),
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.documentTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.documentTemplate.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    return template;
  }

  async update(tenantId: string, id: string, dto: UpdateDocumentTemplateDto) {
    await this.findOne(tenantId, id);
    return this.prisma.documentTemplate.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), activo: false },
    });
  }

  async duplicate(
    tenantId: string,
    id: string,
    dto: DuplicateDocumentTemplateDto,
  ) {
    const original = await this.findOne(tenantId, id);
    const nombre = dto.nombre ?? `${original.nombre} (copia)`;

    return this.prisma.documentTemplate.create({
      data: {
        tenantId,
        nombre,
        descripcion: original.descripcion,
        tipo: original.tipo,
        contenido: original.contenido,
        activo: true,
      },
    });
  }

  async toggleActive(tenantId: string, id: string) {
    const template = await this.findOne(tenantId, id);
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { activo: !template.activo },
    });
  }

  async seedDefaultTemplates(tenantId: string) {
    const created: unknown[] = [];
    for (const tpl of DEFAULT_TEMPLATES) {
      const existing = await this.prisma.documentTemplate.findFirst({
        where: { tenantId, nombre: tpl.nombre, deletedAt: null },
      });
      if (!existing) {
        const doc = await this.prisma.documentTemplate.create({
          data: { ...tpl, tenantId },
        });
        created.push(doc);
      }
    }
    return {
      created: created.length,
      message: `${created.length} plantillas base creadas`,
    };
  }
}
