import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Res,
  Param,
  NotFoundException,
} from "@nestjs/common";
import { CreatePaymentUseCase } from "../../application/use-cases/create-payment.use-case";
import { UpdatePaymentUseCase } from "../../application/use-cases/update-payment.use-case";
import { CreatePaymentDto } from "../dto/create-payment.dto";
import { UpdatePaymentDto } from "../dto/update-payment.dto";
import { PaymentResponseDto } from "../dto/payment-response.dto";
import { PaymentRepository } from "../../application/ports/payment.repository.port";
import { Response } from "express";

@Controller("api/payment")
export class PaymentController {
  constructor(
    @Inject(CreatePaymentUseCase)
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    @Inject(UpdatePaymentUseCase)
    private readonly updatePaymentUseCase: UpdatePaymentUseCase,
    @Inject("PaymentRepository")
    private readonly paymentRepository: PaymentRepository,
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

    if (!result || !result.payment) {
      throw new Error("Failed to create payment");
    }

    const statusCode = result.isNew ? HttpStatus.CREATED : HttpStatus.OK;
    res?.status(statusCode);

    return new PaymentResponseDto(result.payment.toJSON());
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async getPaymentById(@Param("id") id: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findById(id);

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    return new PaymentResponseDto(payment.toJSON());
  }

  @Put(":id")
  @HttpCode(HttpStatus.OK)
  async updatePayment(
    @Param("id") id: string,
    @Body() dto: UpdatePaymentDto,
  ): Promise<PaymentResponseDto> {
    const result = await this.updatePaymentUseCase.execute({
      id,
      dto,
    });

    return new PaymentResponseDto(result.payment.toJSON());
  }
}
