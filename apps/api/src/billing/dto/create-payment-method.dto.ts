import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  type!: string; // CREDIT_CARD, DEBIT_CARD, UPI, META_BILLING

  @IsString()
  name!: string;

  @IsString()
  provider!: string; // VISA, MASTERCARD, RAZORPAY, META

  @IsOptional()
  @IsString()
  last4?: string;

  @IsOptional()
  @IsString()
  expiry?: string;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  metaBillingAccountId?: string;
}
