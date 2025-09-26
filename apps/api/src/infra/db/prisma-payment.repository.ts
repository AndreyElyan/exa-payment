import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { PaymentRepository } from "../../application/ports/payment.repository.port";
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

    const saved = await this.prisma.payment.create({
      data,
    });

    return Payment.restore({
      id: saved.id,
      cpf: saved.cpf,
      description: saved.description,
      amount: Number(saved.amount),
      paymentMethod: saved.paymentMethod as PaymentMethod,
      status: saved.status as PaymentStatus,
      providerRef: saved.providerRef ?? undefined,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
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
}
