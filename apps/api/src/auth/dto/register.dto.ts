import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  nombreTenant: string;

  @IsNotEmpty()
  @IsString()
  nit: string;

  @IsNotEmpty()
  @IsString()
  digitoVerif: string;

  @IsNotEmpty()
  @IsString()
  razonSocial: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(100, {
    message: 'La contraseña no puede superar los 100 caracteres.',
  })
  passwordPlain: string;

  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  apellido: string;
}
