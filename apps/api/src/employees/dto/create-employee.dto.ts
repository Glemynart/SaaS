import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsUUID,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PepTutorDocumentNumberConstraint } from '../../common/validators/pep-tutor-document-number';
import { CreateSocialSecurityAffiliationDto } from './create-social-security-affiliation.dto';

export enum TipoDocIdentidad {
  CC = 'CC',
  CE = 'CE',
  TI = 'TI',
  PA = 'PA',
  NIT = 'NIT',
  PEP = 'PEP',
  PPT = 'PPT',
  PC = 'PC',
}

export enum EmpleadoEstado {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
  RETIRADO = 'RETIRADO',
}

export enum ContratoTipo {
  TERMINO_FIJO = 'TERMINO_FIJO',
  TERMINO_INDEFINIDO = 'TERMINO_INDEFINIDO',
  OBRA_LABOR = 'OBRA_LABOR',
  APRENDIZAJE = 'APRENDIZAJE',
  PRESTACION_SERVICIOS = 'PRESTACION_SERVICIOS',
}

export enum JornadaLaboral {
  COMPLETA = 'COMPLETA',
  MEDIA = 'MEDIA',
  POR_HORAS = 'POR_HORAS',
}

export enum MotivoRetiro {
  RENUNCIA = 'RENUNCIA',
  TERMINACION_CONTRATO = 'TERMINACION_CONTRATO',
  MUTUO_ACUERDO = 'MUTUO_ACUERDO',
  JUSTA_CAUSA = 'JUSTA_CAUSA',
  FALLECIMIENTO = 'FALLECIMIENTO',
  OTRO = 'OTRO',
}

export const TipoSalarioPila = {
  INTEGRAL: 'X',
  FIJO: 'F',
  VARIABLE: 'V',
} as const;
export type TipoSalarioPila =
  (typeof TipoSalarioPila)[keyof typeof TipoSalarioPila];

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @Validate(PepTutorDocumentNumberConstraint)
  cedula: string;

  @IsEnum(TipoDocIdentidad)
  @IsNotEmpty()
  tipoDocumento: TipoDocIdentidad;

  @IsString()
  @IsNotEmpty()
  primerNombre: string;

  @IsString()
  @IsOptional()
  segundoNombre?: string;

  @IsString()
  @IsNotEmpty()
  primerApellido: string;

  @IsString()
  @IsOptional()
  segundoApellido?: string;

  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsNotEmpty()
  cargo: string;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  salario: number;

  @IsEnum(ContratoTipo)
  @IsNotEmpty()
  tipoContrato: ContratoTipo;

  @IsString()
  @IsNotEmpty()
  fechaIngreso: string; // ISO date string

  @IsEnum(EmpleadoEstado)
  @IsOptional()
  estado?: EmpleadoEstado;

  @IsString()
  @IsOptional()
  municipioExpedicionDocId?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  salarioIntegral?: boolean;

  @IsEnum(TipoSalarioPila)
  @IsOptional()
  tipoSalarioPila?: TipoSalarioPila | null;

  @IsEnum(JornadaLaboral)
  @IsOptional()
  jornadaLaboral?: JornadaLaboral;

  @IsString()
  @IsOptional()
  fechaRetiro?: string;

  @IsEnum(MotivoRetiro)
  @IsOptional()
  motivoRetiro?: MotivoRetiro;

  @IsUUID()
  sedeId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSocialSecurityAffiliationDto)
  afiliacionPilaInicial?: CreateSocialSecurityAffiliationDto;
}
