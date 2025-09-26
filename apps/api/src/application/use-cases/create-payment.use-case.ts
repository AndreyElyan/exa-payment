import {
  Injectable,
  BadRequestException,
  ConflictException,
  Inject,
} from "@nestjs/common";
import { Payment, PaymentMethod } from "../../domain/entities/payment.entity";
import { Cpf } from "../../domain/value-objects/cpf.vo";
import { IdempotencyService } from "../../domain/services/idempotency.service";
import { PaymentRepository } from "../ports/payment.repository.port";
import { PaymentProvider } from "../ports/payment-provider.port";
import { CreatePaymentDto } from "../../interfaces/dto/create-payment.dto";

export interface CreatePaymentInput {
  dto: CreatePaymentDto;
  idempotencyKey?: string;
}

export interface CreatePaymentOutput {
  payment: Payment;
  isNew: boolean;
}

@Injectable()
export class CreatePaymentUseCase {
  constructor(
    @Inject("PaymentRepository")
    private readonly paymentRepository: PaymentRepository,
    @Inject("PaymentProvider")
    private readonly paymentProvider: PaymentProvider,
    @Inject(IdempotencyService)
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async execute(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
    const { dto, idempotencyKey } = input;

    // Manual validation to ensure data integrity
    if (typeof dto.amount !== "number" || dto.amount < 0.01) {
      throw new BadRequestException(
        "Amount deve ser um número positivo maior que 0.01",
      );
    }

    if (!["PIX", "CREDIT_CARD"].includes(dto.paymentMethod)) {
      throw new BadRequestException(
        "PaymentMethod deve ser PIX ou CREDIT_CARD",
      );
    }

    if (!dto.description || dto.description.length > 255) {
      throw new BadRequestException(
        "Description deve ter entre 1 e 255 caracteres",
      );
    }

    if (dto.paymentMethod === PaymentMethod.CREDIT_CARD && !idempotencyKey) {
      throw new BadRequestException(
        "Idempotency-Key é obrigatório para CREDIT_CARD",
      );
    }

    try {
      new Cpf(dto.cpf);
    } catch {
      throw new BadRequestException("CPF inválido");
    }

    const bodyHash = this.idempotencyService.generateBodyHash(
      JSON.stringify(dto),
    );

    if (idempotencyKey) {
      try {
        const idempotencyResult = this.idempotencyService.checkKey(
          idempotencyKey,
          bodyHash,
        );

        if (!idempotencyResult.isNew) {
          const existingPayment = await this.paymentRepository.findById(
            idempotencyResult.paymentId!,
          );
          return { payment: existingPayment!, isNew: false };
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "IDEMPOTENCY_KEY_CONFLICT"
        ) {
          throw new ConflictException("IDEMPOTENCY_KEY_CONFLICT");
        }
        throw error;
      }
    }

    const payment = Payment.create({
      cpf: dto.cpf,
      description: dto.description,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    if (savedPayment.isCreditCard()) {
      const providerResult = await this.paymentProvider.createCreditCardCharge({
        amount: savedPayment.amount,
        description: savedPayment.description,
        idempotencyKey: idempotencyKey || savedPayment.id,
      });

      savedPayment.setProviderRef(providerResult.providerRef);
      await this.paymentRepository.update(savedPayment);
    }

    if (idempotencyKey) {
      this.idempotencyService.storeKey(
        idempotencyKey,
        bodyHash,
        savedPayment.id,
      );
    }

    return { payment: savedPayment, isNew: true };
  }
}
