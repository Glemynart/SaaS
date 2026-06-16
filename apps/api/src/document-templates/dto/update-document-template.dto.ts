import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { DocumentTemplateType } from './create-document-template.dto';

export class UpdateDocumentTemplateDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsEnum(DocumentTemplateType)
  @IsOptional()
  tipo?: DocumentTemplateType;

  @IsString()
  @IsOptional()
  contenido?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
