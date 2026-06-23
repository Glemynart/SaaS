import { IsUUID, IsOptional } from 'class-validator';

export class GenerateContractDocumentDto {
  @IsUUID()
  @IsOptional()
  templateId?: string;
}
