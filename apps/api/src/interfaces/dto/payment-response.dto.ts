import {
  PaymentMethod,
  PaymentStatus,
} from "../../domain/entities/payment.entity";
import { ApiProperty } from "@nestjs/swagger";

export class PaymentResponseDto {
  @ApiProperty({
    description: "ID único do pagamento",
    example: "pay_123456789",
  })
  id: string;

  @ApiProperty({
    description: "Status do pagamento",
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: "Método de pagamento",
    enum: PaymentMethod,
    example: PaymentMethod.PIX,
  })
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: "CPF do cliente",
    example: "12345678909",
  })
  cpf: string;

  @ApiProperty({
    description: "Descrição do pagamento",
    example: "Mensalidade do curso",
  })
  description: string;

  @ApiProperty({
    description: "Valor do pagamento",
    example: 199.9,
  })
  amount: number;

  @ApiProperty({
    description: "Referência do provedor de pagamento",
    example: "mp_123456789",
    nullable: true,
  })
  providerRef: string | null;

  @ApiProperty({
    description: "Data de criação",
    example: "2023-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Data da última atualização",
    example: "2023-01-01T00:00:00.000Z",
  })
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
