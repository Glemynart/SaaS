import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsEmail,
  IsArray,
} from 'class-validator';
import { TipoPersona } from '@prisma/client';

// La identidad documental (tipoDocumento + numeroDocumento) es inmutable:
// es la clave canónica del tercero. Para corregirla, crear un tercero nuevo.
export class UpdateTerceroDto {
  @IsString() @IsOptional() digitoVerificacion?: string;

  @IsEnum(TipoPersona) @IsOptional() tipoPersona?: TipoPersona;

  @IsString() @IsOptional() razonSocial?: string;
  @IsString() @IsOptional() primerNombre?: string;
  @IsString() @IsOptional() segundoNombre?: string;
  @IsString() @IsOptional() primerApellido?: string;
  @IsString() @IsOptional() segundoApellido?: string;
  @IsString() @IsOptional() nombreComercial?: string;

  @IsBoolean() @IsOptional() esCliente?: boolean;
  @IsBoolean() @IsOptional() esProveedor?: boolean;
  @IsBoolean() @IsOptional() esEmpleado?: boolean;
  @IsBoolean() @IsOptional() esEntidadGubernamental?: boolean;
  @IsBoolean() @IsOptional() esBanco?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  responsabilidadesFiscales?: string[];

  @IsBoolean() @IsOptional() regimenSimple?: boolean;
  @IsBoolean() @IsOptional() granContribuyente?: boolean;

  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() telefono?: string;
  @IsString() @IsOptional() direccion?: string;
  @IsString() @IsOptional() municipioId?: string;

  @IsBoolean() @IsOptional() activo?: boolean;
}
