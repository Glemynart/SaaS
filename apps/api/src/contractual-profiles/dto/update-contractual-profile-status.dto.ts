import { IsBoolean } from 'class-validator';

export class UpdateContractualProfileStatusDto {
  @IsBoolean()
  activo: boolean;
}
