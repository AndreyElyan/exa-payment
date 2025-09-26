import { Cpf } from '../cpf.vo';

describe('Cpf', () => {
  describe('constructor', () => {
    it('should create a valid CPF', () => {
      const cpf = new Cpf('12345678909');
      expect(cpf.getValue()).toBe('12345678909');
    });

    it('should throw error for invalid CPF format', () => {
      expect(() => new Cpf('123')).toThrow('CPF inválido');
    });

    it('should throw error for sequential digits', () => {
      expect(() => new Cpf('11111111111')).toThrow('CPF inválido');
    });

    it('should throw error for invalid check digits', () => {
      expect(() => new Cpf('12345678900')).toThrow('CPF inválido');
    });

    it('should accept CPF with dots and dashes', () => {
      const cpf = new Cpf('123.456.789-09');
      expect(cpf.getValue()).toBe('12345678909');
    });
  });

  describe('toString', () => {
    it('should return clean CPF', () => {
      const cpf = new Cpf('123.456.789-09');
      expect(cpf.toString()).toBe('12345678909');
    });
  });
});
