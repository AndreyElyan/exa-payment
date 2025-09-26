import { Controller, Post, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { CreatePaymentUseCase } from '../../application/use-cases/create-payment.use-case';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';

@Controller('api/payment')
export class PaymentController {
  constructor(private readonly createPaymentUseCase: CreatePaymentUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PaymentResponseDto> {
    const result = await this.createPaymentUseCase.execute({
      dto,
      idempotencyKey,
    });

    const statusCode = result.isNew ? HttpStatus.CREATED : HttpStatus.OK;

    return new PaymentResponseDto(result.payment.toJSON());
  }
}
