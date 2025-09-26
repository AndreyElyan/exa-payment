import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Res,
} from "@nestjs/common";
import { CreatePaymentUseCase } from "../../application/use-cases/create-payment.use-case";
import { CreatePaymentDto } from "../dto/create-payment.dto";
import { PaymentResponseDto } from "../dto/payment-response.dto";
import { Response } from "express";

@Controller("api/payment")
export class PaymentController {
  constructor(
    @Inject(CreatePaymentUseCase)
    private readonly createPaymentUseCase: CreatePaymentUseCase,
  ) {}

  @Post()
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<PaymentResponseDto> {
    const result = await this.createPaymentUseCase.execute({
      dto,
      idempotencyKey,
    });

    const statusCode = result.isNew ? HttpStatus.CREATED : HttpStatus.OK;
    res?.status(statusCode);

    return new PaymentResponseDto(result.payment.toJSON());
  }
}
