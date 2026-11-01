import { IsBoolean } from 'class-validator';

export class PatchPilaWorkCenterDto {
  @IsBoolean()
  activo: boolean;
}
