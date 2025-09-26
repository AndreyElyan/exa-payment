import { PaymentMethod, PaymentStatus } from '../../domain/entities/payment.entity';

export class PaymentResponseDto {
  id: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  cpf: string;
  description: string;
  amount: number;
  providerRef: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(payment: {
    id: string;
    status: PaymentStatus;
    paymentMethod: PaymentMethod;
    cpf: string;
    description: string;
    amount: number;
    providerRef?: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = payment.id;
    this.status = payment.status;
    this.paymentMethod = payment.paymentMethod;
    this.cpf = payment.cpf;
    this.description = payment.description;
    this.amount = payment.amount;
    this.providerRef = payment.providerRef || null;
    this.createdAt = payment.createdAt;
    this.updatedAt = payment.updatedAt;
  }
}
