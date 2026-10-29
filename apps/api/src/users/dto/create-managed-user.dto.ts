import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const MANAGED_USER_ROLES = [UserRole.ADMIN, UserRole.OPERADOR] as const;

export class CreateManagedUserDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(100, {
    message: 'La contraseña no puede superar los 100 caracteres.',
  })
  passwordPlain!: string;

  @IsIn(MANAGED_USER_ROLES)
  rol!: UserRole;
}
