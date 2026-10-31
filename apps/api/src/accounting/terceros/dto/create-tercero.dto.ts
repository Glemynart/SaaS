import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsEmail,
  IsArray,
  Validate,
} from 'class-validator';
import { TipoDocIdentidad, TipoPersona } from '@prisma/client';
import { PepTutorDocumentNumberConstraint } from '../../../common/validators/pep-tutor-document-number';

export class CreateTerceroDto {
  @IsEnum(TipoDocIdentidad)
  tipoDocumento: TipoDocIdentidad;

  @IsString()
  @IsNotEmpty()
  @Validate(PepTutorDocumentNumberConstraint)
  numeroDocumento: string;

  @IsString()
  @IsOptional()
  digitoVerificacion?: string;

  @IsEnum(TipoPersona)
  tipoPersona: TipoPersona;

  @IsString()
  @IsOptional()
  razonSocial?: string;

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

  @IsString()
  @IsOptional()
  nombreComercial?: string;

  // Roles por banderas
  @IsBoolean() @IsOptional() esCliente?: boolean;
  @IsBoolean() @IsOptional() esProveedor?: boolean;
  @IsBoolean() @IsOptional() esEmpleado?: boolean;
  @IsBoolean() @IsOptional() esEntidadGubernamental?: boolean;
  @IsBoolean() @IsOptional() esBanco?: boolean;

  // Fiscal (exógena)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  responsabilidadesFiscales?: string[];

  @IsBoolean() @IsOptional() regimenSimple?: boolean;
  @IsBoolean() @IsOptional() granContribuyente?: boolean;

  // Contacto
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() telefono?: string;
  @IsString() @IsOptional() direccion?: string;
  @IsString() @IsOptional() municipioId?: string;

  @IsBoolean() @IsOptional() activo?: boolean;
}
