import { Transform } from 'class-transformer';
import { Equals, IsDateString, IsOptional, IsUUID } from 'class-validator';

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreatePilaWorkLocationDto {
  @IsUUID()
  municipioId: string;

  @IsDateString({ strict: true })
  vigenteDesde: string;

  @IsOptional()
  @Transform(trimValue)
  @IsDateString({ strict: true })
  vigenteHasta?: string | null;

  @Equals(true, {
    message: 'Debes confirmar la ubicación laboral declarada por el aportante.',
  })
  confirmacionAportante: true;
}
