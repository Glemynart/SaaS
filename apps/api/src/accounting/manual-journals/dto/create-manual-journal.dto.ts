import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateManualJournalLineDto {
  @IsString()
  @IsNotEmpty()
  cuentaId: string;

  @IsString()
  @IsOptional()
  terceroId?: string;

  @IsString()
  @IsOptional()
  centroCostoId?: string;

  @IsNumber()
  debito: number;

  @IsNumber()
  credito: number;

  @IsNumber()
  @IsOptional()
  baseGravable?: number;

  @IsString()
  @IsOptional()
  descripcion?: string;
}

export class CreateManualJournalDto {
  @IsString()
  @IsNotEmpty()
  tipoComprobanteId: string;

  @IsString()
  @IsNotEmpty()
  periodoId: string;

  @IsDateString()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  concepto: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateManualJournalLineDto)
  lineas: CreateManualJournalLineDto[];
}
