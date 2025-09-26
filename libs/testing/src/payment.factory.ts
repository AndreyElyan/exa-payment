import { CreatePaymentDto } from '@contracts/schemas';

export class PaymentTestFactory {
  static createValidPaymentDto(): CreatePaymentDto {
    return {
      cpf: '12345678901',
      amount: 100.5,
      description: 'Test payment',
      paymentMethod: 'PIX',
    };
  }

  static createCreditCardPaymentDto(): CreatePaymentDto {
    return {
      cpf: '12345678901',
      amount: 250.75,
      description: 'Credit card payment',
      paymentMethod: 'CREDIT_CARD',
    };
  }

  static createInvalidPaymentDto(): Partial<CreatePaymentDto> {
    return {
      cpf: '123',
      amount: -10,
      description: '',
      paymentMethod: 'INVALID' as any,
    };
  }
}
