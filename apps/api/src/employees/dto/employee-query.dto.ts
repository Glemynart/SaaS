import { IsOptional, IsString, IsNumber, Min, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { EmpleadoEstado } from './create-employee.dto';

export class EmployeeQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(EmpleadoEstado)
  estado?: EmpleadoEstado;
}
