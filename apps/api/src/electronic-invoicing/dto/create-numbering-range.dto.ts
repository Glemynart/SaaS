import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AmbienteEmisorElectronico } from '@prisma/client';

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimUppercase({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class CreateNumberingRangeDto {
  @IsEnum(AmbienteEmisorElectronico)
  ambiente: AmbienteEmisorElectronico;

  @Transform(trimValue)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  numeroAutorizacion: string;

  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaAutorizacion: string;

  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  vigenciaDesde: string;

  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  vigenciaHasta: string;

  @Transform(trimUppercase)
  @IsString()
  @Matches(/^[A-Z0-9]{0,4}$/)
  prefijo = '';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  numeroDesde: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  numeroHasta: number;

  @Transform(trimValue)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  motivo: string;
}
