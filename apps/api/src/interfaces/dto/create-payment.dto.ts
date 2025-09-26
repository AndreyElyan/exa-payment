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
import { PaymentMethod } from "../../domain/entities/payment.entity";

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  cpf!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  description!: string;

  @IsNumber()
  @Min(0.01)
  @Max(9999999999.99)
  amount!: number;

  @IsString()
  @IsIn(["PIX", "CREDIT_CARD"])
  paymentMethod!: PaymentMethod;
}
