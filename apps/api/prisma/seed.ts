import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  const payments = [
    {
      cpf: '12345678901',
      description: 'Pagamento teste PIX',
      amount: 100.50,
      paymentMethod: 'PIX',
      status: 'PENDING',
    },
    {
      cpf: '98765432100',
      description: 'Pagamento teste Cartão',
      amount: 250.00,
      paymentMethod: 'CREDIT_CARD',
      status: 'PAID',
      providerRef: 'mp_123456789',
    },
  ];

  for (const payment of payments) {
    await prisma.payment.upsert({
      where: { id: payment.cpf + '_' + payment.paymentMethod },
      update: payment,
      create: payment,
    });
  }

  console.log('✅ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
