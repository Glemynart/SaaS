import { IsOptional, IsString } from 'class-validator';

export class UpdateTenantBrandingDto {
  @IsString()
  @IsOptional()
  representanteLegal?: string | null;
}
