import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}

export class CreateCustomerDto {
  @IsString() @IsNotEmpty() razonSocial: string;
  @IsString() @IsNotEmpty() nit: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() telefono?: string;
  @IsString() @IsOptional() direccion?: string;
}

export class UpdateCustomerDto {
  @IsString() @IsOptional() razonSocial?: string;
  @IsString() @IsOptional() nit?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() telefono?: string;
  @IsString() @IsOptional() direccion?: string;
  @IsEnum(CustomerStatus) @IsOptional() status?: CustomerStatus;
}

export class CreateProductDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsNumber() @Min(0) precio: number;
  @IsNumber() @Min(0) @IsOptional() impuesto?: number;
}

export class UpdateProductDto {
  @IsString() @IsOptional() nombre?: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsNumber() @Min(0) @IsOptional() precio?: number;
  @IsNumber() @Min(0) @IsOptional() impuesto?: number;
  @IsOptional() activo?: boolean;
}

export class InvoiceItemDto {
  @IsString() @IsOptional() productServiceId?: string;
  @IsString() @IsNotEmpty() descripcion: string;
  @IsNumber() @Min(0.001) cantidad: number;
  @IsNumber() @Min(0) valorUnitario: number;
}

export class CreateInvoiceDto {
  @IsString() @IsNotEmpty() customerId: string;
  @IsString() @IsNotEmpty() numero: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus) @IsNotEmpty() status: InvoiceStatus;
}
