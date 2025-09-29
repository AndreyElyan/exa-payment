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
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from "@nestjs/swagger";
import { CreatePaymentUseCase } from "../../application/use-cases/create-payment.use-case";
import { UpdatePaymentUseCase } from "../../application/use-cases/update-payment.use-case";
import { CreatePaymentDto } from "../dto/create-payment.dto";
import { UpdatePaymentDto } from "../dto/update-payment.dto";
import { PaymentResponseDto } from "../dto/payment-response.dto";
import { ListPaymentsQueryDto } from "../dto/list-payments-query.dto";
import { ListPaymentsResponseDto } from "../dto/list-payments-response.dto";
import { PaymentRepository } from "../../application/ports/payment.repository.port";
import { QueryValidationPipe } from "../../common/pipes/query-validation.pipe";
import { Response } from "express";

@ApiTags("payments")
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
  @ApiOperation({
    summary: "Criar pagamento",
    description:
      "Cria um novo pagamento PIX ou CREDIT_CARD. Para CREDIT_CARD é obrigatório o header Idempotency-Key.",
  })
  @ApiResponse({
    status: 201,
    description: "Pagamento criado com sucesso",
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Dados inválidos ou Idempotency-Key obrigatório para CREDIT_CARD",
  })
  @ApiResponse({
    status: 409,
    description: "Conflito de Idempotency-Key",
  })
  @ApiHeader({
    name: "idempotency-key",
    description: "Chave de idempotência (obrigatória para CREDIT_CARD)",
    required: false,
  })
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
  @ApiOperation({
    summary: "Buscar pagamento por ID",
    description: "Retorna os dados de um pagamento específico pelo ID",
  })
  @ApiParam({
    name: "id",
    description: "ID único do pagamento",
    example: "pay_123456789",
  })
  @ApiResponse({
    status: 200,
    description: "Pagamento encontrado com sucesso",
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Pagamento não encontrado",
  })
  async getPaymentById(@Param("id") id: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findById(id);

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    return new PaymentResponseDto(payment.toJSON());
  }

  @Put(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Atualizar status do pagamento",
    description: "Atualiza o status de um pagamento (PENDING → PAID/FAIL)",
  })
  @ApiParam({
    name: "id",
    description: "ID único do pagamento",
    example: "pay_123456789",
  })
  @ApiResponse({
    status: 200,
    description: "Pagamento atualizado com sucesso",
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Transição de status inválida",
  })
  @ApiResponse({
    status: 404,
    description: "Pagamento não encontrado",
  })
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

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Listar pagamentos",
    description: "Lista pagamentos com filtros opcionais e paginação",
  })
  @ApiQuery({
    name: "cpf",
    description: "Filtrar por CPF",
    required: false,
    example: "12345678909",
  })
  @ApiQuery({
    name: "paymentMethod",
    description: "Filtrar por método de pagamento",
    required: false,
    enum: ["PIX", "CREDIT_CARD"],
  })
  @ApiQuery({
    name: "status",
    description: "Filtrar por status",
    required: false,
    enum: ["PENDING", "PAID", "FAIL"],
  })
  @ApiQuery({
    name: "page",
    description: "Número da página",
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    description: "Itens por página (máximo 100)",
    required: false,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: "Lista de pagamentos retornada com sucesso",
    type: ListPaymentsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Parâmetros de consulta inválidos",
  })
  async listPayments(
    @Query(new QueryValidationPipe()) query: ListPaymentsQueryDto,
  ): Promise<ListPaymentsResponseDto> {
    const { cpf, paymentMethod, status, page = 1, limit = 20 } = query;

    const filters = {
      cpf,
      paymentMethod,
      status,
    };

    const result = await this.paymentRepository.findMany(filters, page, limit);

    const paymentDtos = result.items.map(
      (payment) => new PaymentResponseDto(payment.toJSON()),
    );

    return new ListPaymentsResponseDto(paymentDtos, page, limit, result.total);
  }
}
