import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateGeneratedDocumentDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId: string;

  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;
}
