export class Cpf {
  private readonly value: string;

  constructor(cpf: string) {
    if (!this.isValid(cpf)) {
      throw new Error('CPF inválido');
    }
    this.value = this.clean(cpf);
  }

  private clean(cpf: string): string {
    return cpf.replace(/\D/g, '');
  }

  private isValid(cpf: string): boolean {
    const cleaned = this.clean(cpf);

    if (!/^\d{11}$/.test(cleaned)) {
      return false;
    }

    if (/^(\d)\1{10}$/.test(cleaned)) {
      return false;
    }

    const calculateDigit = (cpf: string, length: number): number => {
      let sum = 0;
      for (let i = 0; i < length; i++) {
        sum += parseInt(cpf[i]) * (length + 1 - i);
      }
      const remainder = (sum * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };

    const firstDigit = calculateDigit(cleaned, 9);
    const secondDigit = calculateDigit(cleaned, 10);

    return firstDigit === parseInt(cleaned[9]) && secondDigit === parseInt(cleaned[10]);
  }

  toString(): string {
    return this.value;
  }

  getValue(): string {
    return this.value;
  }
}
