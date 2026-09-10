import { IsString, MinLength } from 'class-validator';

export class RegisterInviteDto {
  @IsString()
  token!: string;

  @IsString()
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
