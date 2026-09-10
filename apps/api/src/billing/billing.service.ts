import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

@Injectable()
export class BillingService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultPaymentMethod();
  }

  async seedDefaultPaymentMethod() {
    const existing = await this.prisma.paymentMethod.findFirst();
    if (!existing) {
      await this.prisma.paymentMethod.create({
        data: {
          type: 'META_BILLING',
          name: 'Meta Direct WABA Billing Account',
          provider: 'META',
          billingEmail: 'admin@fgsnlive.com',
          metaBillingAccountId: '1845046976654799',
          isDefault: true,
          status: 'ACTIVE',
        },
      });
    }
  }

  async getPaymentMethods() {
    return this.prisma.paymentMethod.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async addPaymentMethod(dto: CreatePaymentMethodDto) {
    if (dto.isDefault) {
      await this.prisma.paymentMethod.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.paymentMethod.create({
      data: {
        type: dto.type,
        name: dto.name,
        provider: dto.provider,
        last4: dto.last4,
        expiry: dto.expiry,
        billingEmail: dto.billingEmail || 'admin@fgsnlive.com',
        isDefault: dto.isDefault ?? false,
        status: 'ACTIVE',
        metaBillingAccountId: dto.metaBillingAccountId,
      },
    });
  }

  async setDefault(id: string) {
    const pm = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!pm) throw new NotFoundException('Payment method not found');

    await this.prisma.paymentMethod.updateMany({
      data: { isDefault: false },
    });

    return this.prisma.paymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async deletePaymentMethod(id: string) {
    const pm = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!pm) throw new NotFoundException('Payment method not found');

    await this.prisma.paymentMethod.delete({ where: { id } });
    return { success: true };
  }

  async getMetaBillingStatus() {
    const waba = await this.prisma.wabaConnection.findFirst();
    return {
      wabaId: waba?.wabaId ?? '1845046976654799',
      phoneNumberId: waba?.phoneNumberId ?? '1268849126320372',
      tier: waba?.tier ?? 'TIER_10K',
      currency: 'INR',
      billingHubUrl: 'https://business.facebook.com/billing_hub',
      activeMetaPaymentMethod: 'Direct WABA Payment Method Attached (Active)',
      monthlyFreeUtilityLimit: 1000,
    };
  }
}
