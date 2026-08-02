import { IsEnum } from 'class-validator';
import { ExpedienteCategoria } from '@prisma/client';

export class UploadExpedienteDocDto {
  @IsEnum(ExpedienteCategoria)
  categoria!: ExpedienteCategoria;
}
