import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { Payment, PaymentMethod } from '../../domain/entities/payment.entity';
import { Cpf } from '../../domain/value-objects/cpf.vo';
import { IdempotencyService } from '../../domain/services/idempotency.service';
import { PaymentRepository } from '../ports/payment.repository.port';
import { PaymentProvider } from '../ports/payment-provider.port';
import { CreatePaymentDto } from '../../interfaces/dto/create-payment.dto';

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
    private readonly paymentRepository: PaymentRepository,
    private readonly paymentProvider: PaymentProvider,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async execute(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
    const { dto, idempotencyKey } = input;

    if (dto.paymentMethod === PaymentMethod.CREDIT_CARD && !idempotencyKey) {
      throw new BadRequestException('Idempotency-Key é obrigatório para CREDIT_CARD');
    }

    try {
      new Cpf(dto.cpf);
    } catch {
      throw new BadRequestException('CPF inválido');
    }

    const bodyHash = this.idempotencyService.generateBodyHash(JSON.stringify(dto));

    if (idempotencyKey) {
      try {
        const idempotencyResult = this.idempotencyService.checkKey(idempotencyKey, bodyHash);

        if (!idempotencyResult.isNew) {
          const existingPayment = await this.paymentRepository.findById(
            idempotencyResult.paymentId!,
          );
          return { payment: existingPayment!, isNew: false };
        }
      } catch (error) {
        if (error.message === 'IDEMPOTENCY_KEY_CONFLICT') {
          throw new ConflictException('IDEMPOTENCY_KEY_CONFLICT');
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
      this.idempotencyService.storeKey(idempotencyKey, bodyHash, savedPayment.id);
    }

    return { payment: savedPayment, isNew: true };
  }
}
