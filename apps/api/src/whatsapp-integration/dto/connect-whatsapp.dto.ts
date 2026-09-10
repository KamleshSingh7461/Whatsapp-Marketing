import { IsString, MinLength } from 'class-validator';

/** What the Admin submits after generating a System User permanent token by hand (§03 of the plan). */
export class ConnectWhatsappDto {
  @IsString()
  @MinLength(1)
  wabaId!: string;

  @IsString()
  @MinLength(1)
  phoneNumberId!: string;

  @IsString()
  @MinLength(1)
  businessToken!: string;
}
