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

/**
 * Cuerpo para crear un lote de contratos (N3A.5).
 *
 * `templateId` se persiste como `plantillaId` (FK a Plantilla). Los
 * `empleadoIds` objetivo se persisten dentro de `configuracion.empleadoIds`,
 * que es exactamente lo que LoteEngineService.resolveTargets() lee al procesar.
 */
export class CreateLoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre: string;

  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  empleadoIds: string[];

  @IsOptional()
  @IsUUID()
  sedeId?: string;

  @IsOptional()
  @IsEnum(ContratoTipo)
  tipoContrato?: ContratoTipo;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
