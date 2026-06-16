import { IsString, IsOptional } from 'class-validator';

export class DuplicateDocumentTemplateDto {
  @IsString()
  @IsOptional()
  nombre?: string;
}
