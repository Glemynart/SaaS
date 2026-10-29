import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ContratoTipo } from '../../contracts/dto/create-contract.dto';
import { LoteProposito } from '@prisma/client';

/**
 * Cuerpo para crear un lote de contratos (N3A.5).
 *
 * `templateId` se mantiene opcional para conservar la creación manual
 * existente; una campaña inteligente expresa su propósito y deja que el
 * motor resuelva la plantilla en una fase posterior. Los
 * `empleadoIds` objetivo se persisten dentro de `configuracion.empleadoIds`,
 * que es exactamente lo que LoteEngineService.resolveTargets() lee al procesar.
 */
export class CreateLoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsEnum(LoteProposito)
  proposito?: LoteProposito;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  empleadoIds: string[];

  @IsOptional()
  @IsEnum(ContratoTipo)
  tipoContrato?: ContratoTipo;

  @IsDateString()
  @IsNotEmpty()
  fechaInicio: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
