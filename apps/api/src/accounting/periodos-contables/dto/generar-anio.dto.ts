import { IsInt, Min, Max } from 'class-validator';

export class GenerarAnioDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio: number;
}
