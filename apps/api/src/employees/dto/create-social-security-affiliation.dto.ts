import { Transform } from 'class-transformer';
import { COLOMBIA_DANE_DEPARTMENT_CODES } from '@saas/types';
import {
  IsDateString,
  IsDefined,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

function trimUppercase({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateSocialSecurityAffiliationDto {
  @Transform(trimValue)
  @IsIn(['01'], {
    message: 'El MVP solo admite el cotizante dependiente estándar (01).',
  })
  tipoCotizanteCodigo: string;

  @Transform(trimValue)
  @IsDefined({
    message:
      'El subtipo es obligatorio; usa 00 si no aplica un subtipo especial.',
  })
  @Matches(/^\d{2}$/, {
    message: 'Usa un subtipo de cotizante de dos dígitos.',
  })
  subtipoCotizanteCodigo: string;

  @Transform(trimUppercase)
  @IsString()
  @Length(1, 6)
  epsCodigo: string;

  @Transform(trimValue)
  @IsString()
  @Length(1, 120)
  epsNombre: string;

  @Transform(trimUppercase)
  @IsString()
  @Length(1, 6)
  fondoPensionCodigo: string;

  @Transform(trimValue)
  @IsString()
  @Length(1, 120)
  fondoPensionNombre: string;

  @Transform(trimUppercase)
  @IsOptional()
  @IsIn(['S', 'N'], {
    message:
      'El estado de afiliación pensional debe ser S o N según el soporte.',
  })
  estadoAfiliacionPensional?: 'S' | 'N' | null;

  @Transform(trimUppercase)
  @IsString()
  @Length(1, 6)
  arlCodigo: string;

  @Transform(trimValue)
  @IsString()
  @Length(1, 120)
  arlNombre: string;

  @Transform(trimValue)
  @IsIn(['1', '2', '3', '4', '5'])
  arlClaseRiesgo: string;

  @Transform(trimUppercase)
  @IsString()
  @Length(1, 6)
  cajaCompensacionCodigo: string;

  @Transform(trimValue)
  @IsString()
  @Length(1, 120)
  cajaCompensacionNombre: string;

  @Transform(trimValue)
  @IsIn(COLOMBIA_DANE_DEPARTMENT_CODES, {
    message: 'Selecciona un departamento válido según DIVIPOLA.',
  })
  cajaCompensacionDepartamentoCodigo: string;

  @IsOptional()
  @IsBoolean()
  extranjeroNoObligadoPension?: boolean | null;

  @IsOptional()
  @IsBoolean()
  colombianoEnElExterior?: boolean | null;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  vigenteDesde: string;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  vigenteHasta?: string | null;
}
