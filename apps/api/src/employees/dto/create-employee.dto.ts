import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum TipoDocIdentidad {
  CC = 'CC',
  CE = 'CE',
  TI = 'TI',
  PA = 'PA',
  NIT = 'NIT',
  PEP = 'PEP',
  PPT = 'PPT',
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

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
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

  @Transform(({ value }) => (value === '' ? undefined : value))
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

  @IsEnum(JornadaLaboral)
  @IsOptional()
  jornadaLaboral?: JornadaLaboral;

  @IsString()
  @IsOptional()
  fechaRetiro?: string;

  @IsEnum(MotivoRetiro)
  @IsOptional()
  motivoRetiro?: MotivoRetiro;
}
