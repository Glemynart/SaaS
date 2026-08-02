import { UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const MANAGED_USER_ROLES = [UserRole.ADMIN, UserRole.OPERADOR] as const;

export class UpdateManagedUserDto {
  @IsEmail()
  @IsOptional()
  @MaxLength(254)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(100)
  nombre?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(100)
  apellido?: string;

  @IsIn(MANAGED_USER_ROLES)
  @IsOptional()
  rol?: UserRole;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
