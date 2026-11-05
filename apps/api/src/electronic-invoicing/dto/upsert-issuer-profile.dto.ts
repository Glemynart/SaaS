import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AmbienteEmisorElectronico } from '@prisma/client';

function trimStrings({ value }: { value: unknown }) {
  return Array.isArray(value)
    ? value.map((item: unknown) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;
}

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpsertIssuerProfileDto {
  @IsEnum(AmbienteEmisorElectronico)
  ambiente: AmbienteEmisorElectronico;

  @Transform(trimStrings)
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(32, { each: true })
  responsabilidadesTributarias: string[];

  @Transform(trimValue)
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  motivo: string;
}
