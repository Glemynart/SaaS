import { IsOptional, IsString, IsNumber, Min, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export enum GeneratedDocumentTypeFilter {
  CONTRACT = 'CONTRACT',
  CERTIFICATION = 'CERTIFICATION',
  LETTER = 'LETTER',
  MEMO = 'MEMO',
}

export class GeneratedDocumentQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(GeneratedDocumentTypeFilter)
  tipo?: GeneratedDocumentTypeFilter;
}
