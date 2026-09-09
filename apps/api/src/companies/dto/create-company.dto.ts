import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // Appoints the first Company Admin at creation time.
  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(2)
  adminName!: string;

  @IsString()
  @MinLength(8)
  adminTempPassword!: string;
}
