import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  EmpleadoEstado,
  ContratoTipo,
  JornadaLaboral,
  MotivoRetiro,
} from './create-employee.dto';

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
