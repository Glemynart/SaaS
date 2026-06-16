import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DANE_SEED = [
  { codigo: '11001', nombre: 'Bogotá D.C.', departamento: 'Bogotá D.C.' },
  { codigo: '05001', nombre: 'Medellín', departamento: 'Antioquia' },
  { codigo: '76001', nombre: 'Cali', departamento: 'Valle del Cauca' },
  { codigo: '08001', nombre: 'Barranquilla', departamento: 'Atlántico' },
  { codigo: '13001', nombre: 'Cartagena de Indias', departamento: 'Bolívar' },
  { codigo: '54001', nombre: 'Cúcuta', departamento: 'Norte de Santander' },
  { codigo: '68001', nombre: 'Bucaramanga', departamento: 'Santander' },
  { codigo: '66001', nombre: 'Pereira', departamento: 'Risaralda' },
  { codigo: '17001', nombre: 'Manizales', departamento: 'Caldas' },
  { codigo: '15001', nombre: 'Tunja', departamento: 'Boyacá' },
  { codigo: '19001', nombre: 'Popayán', departamento: 'Cauca' },
  { codigo: '23001', nombre: 'Montería', departamento: 'Córdoba' },
  { codigo: '20001', nombre: 'Valledupar', departamento: 'Cesar' },
  { codigo: '41001', nombre: 'Neiva', departamento: 'Huila' },
  { codigo: '63001', nombre: 'Armenia', departamento: 'Quindío' },
  { codigo: '73001', nombre: 'Ibagué', departamento: 'Tolima' },
  { codigo: '52001', nombre: 'Pasto', departamento: 'Nariño' },
  { codigo: '70001', nombre: 'Sincelejo', departamento: 'Sucre' },
  { codigo: '44001', nombre: 'Riohacha', departamento: 'La Guajira' },
  { codigo: '18001', nombre: 'Florencia', departamento: 'Caquetá' },
];

@Injectable()
export class DaneService implements OnModuleInit {
  private readonly logger = new Logger(DaneService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    let created = 0;
    for (const m of DANE_SEED) {
      const exists = await this.prisma.municipioDane.findUnique({
        where: { codigo: m.codigo },
      });
      if (!exists) {
        await this.prisma.municipioDane.create({ data: m });
        created++;
      }
    }
    if (created > 0) this.logger.log(`${created} municipios DANE creados.`);
  }
}
