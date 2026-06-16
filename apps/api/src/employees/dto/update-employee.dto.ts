import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EmpleadoEstado, ContratoTipo } from './create-employee.dto';

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  cedula?: string;

  @IsString()
  @IsOptional()
  tipoDocumento?: string;

  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  apellido?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  cargo?: string;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  @IsOptional()
  salario?: number;

  @IsEnum(ContratoTipo)
  @IsOptional()
  tipoContrato?: ContratoTipo;

  @IsString()
  @IsOptional()
  fechaIngreso?: string;

  @IsEnum(EmpleadoEstado)
  @IsOptional()
  estado?: EmpleadoEstado;
}
