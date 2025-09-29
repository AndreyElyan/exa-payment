import { PaymentResponseDto } from "./payment-response.dto";
import { ApiProperty } from "@nestjs/swagger";

export class ListPaymentsResponseDto {
  @ApiProperty({
    description: "Lista de pagamentos",
    type: [PaymentResponseDto],
  })
  items: PaymentResponseDto[];

  @ApiProperty({
    description: "Página atual",
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: "Itens por página",
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: "Total de itens",
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: "Indica se há próxima página",
    example: true,
  })
  hasNextPage: boolean;

  constructor(
    items: PaymentResponseDto[],
    page: number,
    limit: number,
    total: number,
  ) {
    this.items = items;
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.hasNextPage = page * limit < total;
  }
}
