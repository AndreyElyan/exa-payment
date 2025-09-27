import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from "class-validator";
import { Transform, Type } from "class-transformer";
import {
  PaymentMethod,
  PaymentStatus,
} from "../../domain/entities/payment.entity";

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: "PaymentMethod must be PIX or CREDIT_CARD",
  })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus, {
    message: "Status must be PENDING, PAID, or FAIL",
  })
  status?: PaymentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Page must be an integer" })
  @Min(1, { message: "Page must be at least 1" })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Limit must be an integer" })
  @Min(1, { message: "Limit must be at least 1" })
  @Max(100, { message: "Limit cannot exceed 100" })
  limit?: number = 20;
}
