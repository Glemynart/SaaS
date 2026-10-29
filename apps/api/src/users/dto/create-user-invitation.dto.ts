import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

const INVITABLE_USER_ROLES = [UserRole.ADMIN, UserRole.OPERADOR] as const;

export class CreateUserInvitationDto {
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

  @IsIn(INVITABLE_USER_ROLES)
  rol!: UserRole;
}
