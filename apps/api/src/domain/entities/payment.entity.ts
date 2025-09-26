export enum PaymentMethod {
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAIL = 'FAIL',
}

export interface PaymentProps {
  id: string;
  cpf: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  providerRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Payment {
  private constructor(private props: PaymentProps) {}

  static create(props: Omit<PaymentProps, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Payment {
    return new Payment({
      ...props,
      id: '',
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static restore(props: PaymentProps): Payment {
    return new Payment(props);
  }

  get id(): string {
    return this.props.id;
  }

  get cpf(): string {
    return this.props.cpf;
  }

  get description(): string {
    return this.props.description;
  }

  get amount(): number {
    return this.props.amount;
  }

  get paymentMethod(): PaymentMethod {
    return this.props.paymentMethod;
  }

  get status(): PaymentStatus {
    return this.props.status;
  }

  get providerRef(): string | undefined {
    return this.props.providerRef;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  setProviderRef(providerRef: string): void {
    this.props.providerRef = providerRef;
    this.props.updatedAt = new Date();
  }

  isCreditCard(): boolean {
    return this.props.paymentMethod === PaymentMethod.CREDIT_CARD;
  }

  isPix(): boolean {
    return this.props.paymentMethod === PaymentMethod.PIX;
  }

  toJSON(): PaymentProps {
    return { ...this.props };
  }
}
