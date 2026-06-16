import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum DocumentTemplateType {
  CONTRACT = 'CONTRACT',
  CERTIFICATION = 'CERTIFICATION',
  LETTER = 'LETTER',
  MEMO = 'MEMO',
}

export class CreateDocumentTemplateDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsEnum(DocumentTemplateType)
  @IsNotEmpty()
  tipo: DocumentTemplateType;

  @IsString()
  @IsNotEmpty()
  contenido: string;
}
