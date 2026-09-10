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
import { Role } from '@prisma/client';
import { BillingService } from './billing.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('payment-methods')
  @Roles(Role.ADMIN)
  getPaymentMethods() {
    return this.billingService.getPaymentMethods();
  }

  @Post('payment-methods')
  @Roles(Role.ADMIN)
  addPaymentMethod(@Body() dto: CreatePaymentMethodDto) {
    return this.billingService.addPaymentMethod(dto);
  }

  @Patch('payment-methods/:id/default')
  @Roles(Role.ADMIN)
  setDefault(@Param('id') id: string) {
    return this.billingService.setDefault(id);
  }

  @Delete('payment-methods/:id')
  @Roles(Role.ADMIN)
  deletePaymentMethod(@Param('id') id: string) {
    return this.billingService.deletePaymentMethod(id);
  }

  @Get('meta-status')
  @Roles(Role.ADMIN)
  getMetaBillingStatus() {
    return this.billingService.getMetaBillingStatus();
  }
}
