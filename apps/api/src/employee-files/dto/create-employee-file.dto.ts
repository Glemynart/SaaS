import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';

export enum EmployeeFileCategory {
  CONTRACT = 'CONTRACT',
  CERTIFICATION = 'CERTIFICATION',
  MEMO = 'MEMO',
  LETTER = 'LETTER',
  OTHER = 'OTHER',
}

export class CreateEmployeeFileDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(EmployeeFileCategory)
  @IsNotEmpty()
  categoria: EmployeeFileCategory;

  @IsString()
  @IsNotEmpty()
  archivoUrl: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsOptional()
  tamanoBytes?: number;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
