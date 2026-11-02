import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  Min,
  IsEmail,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
export class CreateCustomerDto {
  @IsString() @IsNotEmpty() razonSocial: string;
  @IsString() @IsNotEmpty() nit: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() telefono?: string;
  @IsString() @IsOptional() direccion?: string;
  @IsString() @IsOptional() terceroId?: string | null;
}

export class UpdateCustomerDto {
  @IsString() @IsOptional() razonSocial?: string;
  @IsString() @IsOptional() nit?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() telefono?: string;
  @IsString() @IsOptional() direccion?: string;
  @IsString() @IsOptional() terceroId?: string | null;
  @IsEnum(CustomerStatus) @IsOptional() status?: CustomerStatus;
}

export class CreateProductDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsNumber() @Min(0) precio: number;
  @IsIn([0, 5, 19]) impuesto: number;
}

export class UpdateProductDto {
  @IsString() @IsOptional() nombre?: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsNumber() @Min(0) @IsOptional() precio?: number;
  @IsIn([0, 5, 19]) @IsOptional() impuesto?: number;
  @IsOptional() activo?: boolean;
}

export class InvoiceItemDto {
  @IsString() @IsOptional() productServiceId?: string;
  @IsString() @IsNotEmpty() descripcion: string;
  @IsNumber() @Min(0.001) cantidad: number;
  @IsNumber() @Min(0) valorUnitario: number;
  @IsIn([0, 5, 19]) porcentajeImpuesto: number;
}

export class CreateInvoiceDto {
  @IsString() @IsNotEmpty() customerId: string;
  @IsString() @IsNotEmpty() numero: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus) @IsNotEmpty() status: InvoiceStatus;
  @IsString() @IsOptional() motivo?: string;
}
