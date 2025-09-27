import { PaymentResponseDto } from "./payment-response.dto";

export class ListPaymentsResponseDto {
  items: PaymentResponseDto[];
  page: number;
  limit: number;
  total: number;
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
