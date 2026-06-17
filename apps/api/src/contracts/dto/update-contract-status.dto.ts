import { IsEnum, IsNotEmpty } from 'class-validator';

export enum ContratoEstado {
  VIGENTE = 'VIGENTE',
  VENCIDO = 'VENCIDO',
  TERMINADO = 'TERMINADO',
  RENOVADO = 'RENOVADO',
}

export class UpdateContractStatusDto {
  @IsEnum(ContratoEstado)
  @IsNotEmpty()
  estado: ContratoEstado;
}
