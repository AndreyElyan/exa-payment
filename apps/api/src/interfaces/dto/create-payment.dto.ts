import {
  IsString,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  Min,
  Max,
  Length,
  IsIn,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PaymentMethod } from "../../domain/entities/payment.entity";

export class CreatePaymentDto {
  @ApiProperty({
    description: "CPF do cliente (apenas números)",
    example: "12345678909",
    minLength: 11,
    maxLength: 11,
  })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  cpf!: string;

  @ApiProperty({
    description: "Descrição do pagamento",
    example: "Mensalidade do curso",
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  description!: string;

  @ApiProperty({
    description: "Valor do pagamento",
    example: 199.9,
    minimum: 0.01,
    maximum: 9999999999.99,
  })
  @IsNumber()
  @Min(0.01)
  @Max(9999999999.99)
  amount!: number;

  @ApiProperty({
    description: "Método de pagamento",
    enum: PaymentMethod,
    example: PaymentMethod.PIX,
  })
  @IsString()
  @IsIn(["PIX", "CREDIT_CARD"])
  paymentMethod!: PaymentMethod;
}
