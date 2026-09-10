import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('payment-methods')
  getPaymentMethods() {
    return this.billingService.getPaymentMethods();
  }

  @Post('payment-methods')
  addPaymentMethod(@Body() dto: CreatePaymentMethodDto) {
    return this.billingService.addPaymentMethod(dto);
  }

  @Patch('payment-methods/:id/default')
  setDefault(@Param('id') id: string) {
    return this.billingService.setDefault(id);
  }

  @Delete('payment-methods/:id')
  deletePaymentMethod(@Param('id') id: string) {
    return this.billingService.deletePaymentMethod(id);
  }

  @Get('meta-status')
  getMetaBillingStatus() {
    return this.billingService.getMetaBillingStatus();
  }
}
