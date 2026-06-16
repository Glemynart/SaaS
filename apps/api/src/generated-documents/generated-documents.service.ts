import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGeneratedDocumentDto } from './dto/create-generated-document.dto';
import { GeneratedDocumentQueryDto } from './dto/generated-document-query.dto';
import { Prisma } from '@prisma/client';
import { EmployeeFilesService } from '../employee-files/employee-files.service';
import { AuditService } from '../audit/audit.service';
import { formatNombreCompleto } from '@saas/types';
import * as path from 'path';
import * as fs from 'fs';

interface ReplacementContext {
  NOMBRE_COMPLETO: string;
  DOCUMENTO: string;
  CARGO: string;
  SALARIO: string;
  TIPO_CONTRATO: string;
  FECHA_INGRESO: string;
  EMPRESA: string;
  NIT: string;
  REPRESENTANTE_LEGAL: string;
  LOGO_EMPRESA: string;
  FIRMA_REPRESENTANTE: string;
}

@Injectable()
export class GeneratedDocumentsService {
  constructor(
    private prisma: PrismaService,
    private employeeFilesService: EmployeeFilesService,
    private auditService: AuditService,
  ) {}

  async generate(tenantId: string, dto: CreateGeneratedDocumentDto) {
    const employee = await this.prisma.empleado.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: dto.templateId, tenantId, deletedAt: null },
    });
    if (!template) {
      throw new NotFoundException('Plantilla no encontrada');
    }

    if (!template.activo) {
      throw new BadRequestException('La plantilla seleccionada está inactiva');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const context: ReplacementContext = {
      NOMBRE_COMPLETO: formatNombreCompleto({
        primerNombre: employee.primerNombre,
        segundoNombre: employee.segundoNombre,
        primerApellido: employee.primerApellido,
        segundoApellido: employee.segundoApellido,
      }),
      DOCUMENTO: `${employee.tipoDocumento} ${employee.cedula}`,
      CARGO: employee.cargo,
      SALARIO: new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(employee.salario)),
      TIPO_CONTRATO: this.formatTipoContrato(employee.tipoContrato),
      FECHA_INGRESO: new Date(employee.fechaIngreso).toLocaleDateString(
        'es-CO',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        },
      ),
      EMPRESA: tenant.razonSocial ?? tenant.nombre,
      NIT: tenant.nit,
      REPRESENTANTE_LEGAL: tenant.representanteLegal ?? 'No definido',
      LOGO_EMPRESA: tenant.logoUrl
        ? `<img src="${tenant.logoUrl}" alt="Logo ${tenant.nombre}" style="max-width:200px;height:auto;" />`
        : '',
      FIRMA_REPRESENTANTE: tenant.firmaRepresentanteUrl
        ? `<img src="${tenant.firmaRepresentanteUrl}" alt="Firma representante legal" style="max-width:180px;height:auto;" />`
        : '',
    };

    const contenidoFinal = this.replaceVariables(template.contenido, context);

    return this.prisma.generatedDocument.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        templateId: dto.templateId,
        nombre: dto.nombre,
        contenidoFinal,
        tipo: template.tipo,
      },
    });
  }

  async findAll(tenantId: string, query: GeneratedDocumentQueryDto) {
    const { page = 1, limit = 10, search, employeeId, tipo } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.GeneratedDocumentWhereInput = {
      tenantId,
      ...(employeeId && { employeeId }),
      ...(tipo && { tipo }),
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { contenidoFinal: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.generatedDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              primerNombre: true,
              segundoNombre: true,
              primerApellido: true,
              segundoApellido: true,
              cedula: true,
              cargo: true,
            },
          },
          template: {
            select: { id: true, nombre: true, tipo: true },
          },
        },
      }),
      this.prisma.generatedDocument.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const doc = await this.prisma.generatedDocument.findFirst({
      where: { id, tenantId },
      include: {
        employee: {
          select: {
            id: true,
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
            cedula: true,
            cargo: true,
            tipoDocumento: true,
          },
        },
        template: {
          select: { id: true, nombre: true, tipo: true },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException('Documento generado no encontrado');
    }

    return doc;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.generatedDocument.delete({ where: { id } });
  }

  async generatePdf(tenantId: string, userId: string, id: string) {
    const doc = await this.findOne(tenantId, id);
    if (!doc) throw new NotFoundException('Documento no encontrado');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');

    const html = this.buildPdfHtml(doc.contenidoFinal, tenant, doc.employee);

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdfsDir = path.join(process.cwd(), '..', '..', 'uploads', 'pdfs');
    if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir, { recursive: true });

    const pdfFilename = `${tenantId}-${id}.pdf`;
    const pdfPath = path.join(pdfsDir, pdfFilename);
    const pdfUrl = `/uploads/pdfs/${pdfFilename}`;

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '2.5cm', right: '2.5cm' },
      printBackground: true,
    });

    await browser.close();

    const updated = await this.prisma.generatedDocument.update({
      where: { id },
      data: { pdfUrl },
      select: {
        id: true,
        pdfUrl: true,
        nombre: true,
        tipo: true,
        employeeId: true,
        tenantId: true,
      },
    });

    await this.employeeFilesService.createFromGeneratedDoc(
      updated.tenantId,
      updated.id,
      updated.employeeId,
      updated.nombre,
      pdfUrl,
      updated.tipo,
    );

    this.auditService
      .log({
        tenantId: updated.tenantId,
        userId,
        action: 'PDF_GENERATE',
        entityType: 'GeneratedDocument',
        entityId: updated.id,
        metadata: { pdfUrl },
      })
      .catch(() => {});

    return { id: updated.id, pdfUrl: updated.pdfUrl, nombre: updated.nombre };
  }

  private async getBrowser() {
    const puppeteer = await import('puppeteer');
    try {
      return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch {
      return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: this.findChromePath(),
      });
    }
  }

  private findChromePath(): string | undefined {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
    return undefined;
  }

  private buildPdfHtml(
    content: string,
    tenant: {
      razonSocial: string | null;
      nombre: string;
      logoUrl: string | null;
    },
    employee: {
      primerNombre: string;
      segundoNombre: string | null;
      primerApellido: string;
      segundoApellido: string | null;
      cedula: string;
    },
  ) {
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';
    const logoHtml = tenant.logoUrl
      ? `<img src="${backendUrl}${tenant.logoUrl}" alt="${tenant.nombre}" />`
      : '';
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 12pt; line-height: 1.7; color: #1a1a1a; padding: 0; }
  .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 32px; display: flex; align-items: center; gap: 20px; }
  .header img { max-width: 160px; max-height: 64px; object-fit: contain; }
  .header-info { flex: 1; }
  .header-info h1 { font-size: 14pt; margin: 0 0 4px 0; color: #2563eb; }
  .header-info p { font-size: 9pt; color: #666; margin: 0; }
  h2 { font-size: 14pt; font-weight: 700; margin: 24px 0 8px 0; }
  h3 { font-size: 12pt; font-weight: 600; margin: 16px 0 6px 0; }
  p { margin: 4px 0; }
  ul, ol { padding-left: 24px; margin: 8px 0; }
  li { margin: 3px 0; }
  blockquote { border-left: 3px solid #e5e7eb; padding-left: 16px; margin: 12px 0; color: #666; font-style: italic; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  strong { font-weight: 600; }
  img { max-width: 100%; height: auto; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #999; text-align: center; }
  .footer p { margin: 2px 0; }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <div class="header-info">
      <h1>${tenant.razonSocial ?? tenant.nombre}</h1>
      <p>Documento generado para: ${formatNombreCompleto({ primerNombre: employee.primerNombre, segundoNombre: employee.segundoNombre, primerApellido: employee.primerApellido, segundoApellido: employee.segundoApellido })} — ${employee.cedula}</p>
    </div>
  </div>
  ${content}
  <div class="footer">
    <p>Este documento es un snapshot generado automáticamente por La Oficina Nítida.</p>
    <p>Los datos reflejan el estado al momento de la generación.</p>
  </div>
</body>
</html>`;
  }

  private replaceVariables(
    template: string,
    context: ReplacementContext,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(context)) {
      result = result.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        String(value),
      );
    }
    return result;
  }

  private formatTipoContrato(tipo: string): string {
    const labels: Record<string, string> = {
      TERMINO_FIJO: 'Término Fijo',
      TERMINO_INDEFINIDO: 'Término Indefinido',
      OBRA_LABOR: 'Obra o Labor',
      APRENDIZAJE: 'Aprendizaje',
      PRESTACION_SERVICIOS: 'Prestación de Servicios',
    };
    return labels[tipo] ?? tipo.replace(/_/g, ' ');
  }
}
