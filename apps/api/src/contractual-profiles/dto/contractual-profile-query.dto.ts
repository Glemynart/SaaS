import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ContractualProfileQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
