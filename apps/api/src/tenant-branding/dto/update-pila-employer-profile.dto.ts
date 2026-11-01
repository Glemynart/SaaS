import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdatePilaEmployerProfileDto {
  @IsIn(['NI'])
  @IsOptional()
  pilaTipoDocumentoAportante?: string | null;

  @IsIn(['1', '2', '3', '4', '5'])
  @IsOptional()
  pilaNaturalezaJuridica?: string | null;

  @IsIn(['N', 'J'])
  @IsOptional()
  pilaTipoPersona?: string | null;

  @IsIn(['U', 'S'])
  @IsOptional()
  pilaFormaPresentacion?: string | null;

  @Matches(/^[A-Za-z0-9]{1,10}$/)
  @IsOptional()
  pilaCodigoSucursal?: string | null;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  pilaNombreSucursal?: string | null;

  @Matches(/^\d{4}$/)
  @IsOptional()
  pilaCodigoActividadEconomica?: string | null;

  @IsString()
  @MaxLength(16)
  @IsOptional()
  pilaCodigoArlAportante?: string | null;

  @IsIn(['1'])
  @IsOptional()
  pilaTipoAportante?: string | null;

  @Matches(/^\d{1,10}$/)
  @IsOptional()
  pilaFax?: string | null;

  @Matches(/^[A-Z0-9]{2}$/)
  @IsOptional()
  pilaRepresentanteTipoDocumento?: string | null;

  @Matches(/^[A-Za-z0-9]{1,16}$/)
  @IsOptional()
  pilaRepresentanteNumeroDocumento?: string | null;

  @IsString()
  @MaxLength(20)
  @IsOptional()
  pilaRepresentantePrimerApellido?: string | null;

  @IsString()
  @MaxLength(30)
  @IsOptional()
  pilaRepresentanteSegundoApellido?: string | null;

  @IsString()
  @MaxLength(20)
  @IsOptional()
  pilaRepresentantePrimerNombre?: string | null;

  @IsString()
  @MaxLength(30)
  @IsOptional()
  pilaRepresentanteSegundoNombre?: string | null;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  @IsOptional()
  pilaFechaMatriculaMercantil?: string | null;

  @IsBoolean()
  @IsOptional()
  pilaBeneficioLey1429?: boolean | null;

  @IsBoolean()
  @IsOptional()
  pilaBeneficioCcfLey1429?: boolean | null;

  @IsBoolean()
  @IsOptional()
  pilaAportesExoneradosConfirmado?: boolean | null;

  @IsBoolean()
  @IsOptional()
  pilaSinAccionEspecial?: boolean | null;
}
