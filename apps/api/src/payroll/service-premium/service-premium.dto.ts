import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServicePremiumBatchDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  semester!: number;
}

export class CreateServicePremiumCorrectionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(15)
  @MaxLength(500)
  reason!: string;
}
