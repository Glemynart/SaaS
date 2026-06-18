import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsUUID,
  ValidateIf,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  EmpleadoEstado,
  ContratoTipo,
  JornadaLaboral,
  MotivoRetiro,
  TipoDocIdentidad,
} from './create-employee.dto';

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  cedula?: string;

  @IsEnum(TipoDocIdentidad)
  @IsOptional()
  tipoDocumento?: TipoDocIdentidad;

  @IsString()
  @IsOptional()
  primerNombre?: string;

  @IsString()
  @IsOptional()
  segundoNombre?: string;

  @IsString()
  @IsOptional()
  primerApellido?: string;

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

  @ValidateIf((o) => o.sedeId !== null && o.sedeId !== undefined)
  @IsUUID()
  @IsOptional()
  sedeId?: string | null;
}
