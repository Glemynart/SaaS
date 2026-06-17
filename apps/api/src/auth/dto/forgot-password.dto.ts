import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsNotEmpty()
  @IsString()
  tenantNit: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;
}
