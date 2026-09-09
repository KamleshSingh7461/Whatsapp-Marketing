import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  /** Super Admin only — creates a company and appoints its first Company Admin. */
  async create(dto: CreateCompanyDto) {
    const passwordHash = await bcrypt.hash(dto.adminTempPassword, 12);

    return this.prisma.company.create({
      data: {
        name: dto.name,
        users: {
          create: {
            email: dto.adminEmail,
            name: dto.adminName,
            passwordHash,
            role: Role.COMPANY_ADMIN,
          },
        },
      },
      include: { users: { select: { id: true, email: true, name: true, role: true } } },
    });
  }

  findAll() {
    return this.prisma.company.findMany({
      select: { id: true, name: true, status: true, createdAt: true },
    });
  }

  findOne(id: string) {
    return this.prisma.company.findUniqueOrThrow({
      where: { id },
      include: { wabaConnection: true, users: { select: { id: true, email: true, name: true, role: true } } },
    });
  }
}
