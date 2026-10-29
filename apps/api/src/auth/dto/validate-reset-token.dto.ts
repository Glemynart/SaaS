import { Allow } from 'class-validator';

export class ValidateResetTokenDto {
  @Allow()
  token: unknown;
}
