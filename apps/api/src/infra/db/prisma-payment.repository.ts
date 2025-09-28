import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import {
  PaymentRepository,
  FindManyFilters,
  FindManyResult,
} from "../../application/ports/payment.repository.port";
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "../../domain/entities/payment.entity";

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async save(payment: Payment): Promise<Payment> {
    const data = {
      id: payment.id,
      cpf: payment.cpf,
      description: payment.description,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      providerRef: payment.providerRef || null,
    };
    const result = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.payment.create({
        data,
      });

      await tx.$executeRaw`SELECT 1`;

      return saved;
    });

    return Payment.restore({
      id: result.id,
      cpf: result.cpf,
      description: result.description,
      amount: Number(result.amount),
      paymentMethod: result.paymentMethod as PaymentMethod,
      status: result.status as PaymentStatus,
      providerRef: result.providerRef ?? undefined,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  }

  async findById(id: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return null;
    }

    return Payment.restore({
      id: payment.id,
      cpf: payment.cpf,
      description: payment.description,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod as PaymentMethod,
      status: payment.status as PaymentStatus,
      providerRef: payment.providerRef ?? undefined,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  }

  async update(payment: Payment): Promise<Payment> {
    const data = {
      cpf: payment.cpf,
      description: payment.description,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      providerRef: payment.providerRef || null,
    };

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data,
    });

    return Payment.restore({
      id: updated.id,
      cpf: updated.cpf,
      description: updated.description,
      amount: Number(updated.amount),
      paymentMethod: updated.paymentMethod as PaymentMethod,
      status: updated.status as PaymentStatus,
      providerRef: updated.providerRef ?? undefined,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  }

  async findMany(
    filters: FindManyFilters,
    page: number,
    limit: number,
  ): Promise<FindManyResult> {
    const where: any = {};

    if (filters.cpf) {
      where.cpf = filters.cpf;
    }

    if (filters.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.payment.count({ where }),
    ]);

    const paymentItems = items.map((item) =>
      Payment.restore({
        id: item.id,
        cpf: item.cpf,
        description: item.description,
        amount: Number(item.amount),
        paymentMethod: item.paymentMethod as PaymentMethod,
        status: item.status as PaymentStatus,
        providerRef: item.providerRef ?? undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }),
    );

    return {
      items: paymentItems,
      total,
    };
  }
}
