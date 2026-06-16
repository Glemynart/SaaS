import { IsString, IsOptional } from 'class-validator';

export class UpdateTenantBrandingDto {
  @IsString()
  @IsOptional()
  representanteLegal?: string;
}
