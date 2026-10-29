import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ExpedienteCategoria } from '@prisma/client';

export class UploadExpedienteDocDto {
  @IsEnum(ExpedienteCategoria)
  categoria!: ExpedienteCategoria;

  @IsOptional()
  @IsUUID()
  familiaId?: string;
}
