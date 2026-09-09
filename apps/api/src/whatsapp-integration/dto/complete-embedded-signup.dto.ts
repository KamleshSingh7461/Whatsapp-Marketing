import { IsString, MinLength } from 'class-validator';

/** What the frontend sends after a Company Admin finishes the Embedded Signup v4 widget. */
export class CompleteEmbeddedSignupDto {
  @IsString()
  @MinLength(1)
  wabaId!: string;

  @IsString()
  @MinLength(1)
  phoneNumberId!: string;

  @IsString()
  @MinLength(1)
  exchangeableCode!: string;
}
