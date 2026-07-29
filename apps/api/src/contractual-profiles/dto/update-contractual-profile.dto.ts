import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContractualProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(160)
  nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  descripcion?: string;
}
