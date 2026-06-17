import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';

export enum ContratoTipo {
  TERMINO_FIJO = 'TERMINO_FIJO',
  TERMINO_INDEFINIDO = 'TERMINO_INDEFINIDO',
  OBRA_LABOR = 'OBRA_LABOR',
  APRENDIZAJE = 'APRENDIZAJE',
  PRESTACION_SERVICIOS = 'PRESTACION_SERVICIOS',
}

export class CreateContractDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  cargo: string;

  @IsNumber()
  @Min(0)
  salario: number;

  @IsEnum(ContratoTipo)
  @IsNotEmpty()
  tipo: ContratoTipo;

  @IsDateString()
  @IsNotEmpty()
  fechaInicio: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @IsUUID()
  @IsOptional()
  sedeId?: string;

  @IsUUID()
  @IsOptional()
  plantillaId?: string;
}
