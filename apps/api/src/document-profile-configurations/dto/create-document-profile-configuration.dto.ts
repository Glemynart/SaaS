import { DocumentTemplateType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateDocumentProfileConfigurationDto {
  @IsUUID()
  perfilContractualId: string;

  @IsEnum(DocumentTemplateType)
  tipoDocumental: DocumentTemplateType;

  @IsUUID()
  plantillaId: string;

  @IsDateString()
  vigenteDesde: string;

  @IsDateString()
  @IsOptional()
  vigenteHasta?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
