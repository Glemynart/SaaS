import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class DocumentResolutionPreviewDto {
  @IsUUID()
  loteId: string;

  @IsDateString()
  @IsOptional()
  fechaProceso?: string;
}
