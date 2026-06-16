import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

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

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  cedula: string;

  @IsString()
  @IsNotEmpty()
  tipoDocumento: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

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
}
