import { IsUUID } from 'class-validator';

export class AssignContractualProfileDto {
  @IsUUID()
  perfilContractualId: string;
}
