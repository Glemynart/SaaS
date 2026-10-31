import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreatePilaWorkAssignmentDto {
  @IsUUID()
  centroTrabajoId: string;

  @Transform(trimValue)
  @IsString()
  @Matches(/^[1-5]\d{6}$/, {
    message:
      'La actividad de riesgos debe tener siete dígitos del Decreto 768 de 2022.',
  })
  codigoActividadEconomica: string;

  @IsDateString({ strict: true })
  vigenteDesde: string;

  @IsOptional()
  @IsDateString({ strict: true })
  vigenteHasta?: string | null;
}
