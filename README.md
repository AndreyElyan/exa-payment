# Exa Payment - Sistema de Pagamentos

> Sistema de pagamentos didático e robusto, focado em boas práticas de Clean Code, Clean Architecture e observabilidade.

## 🎯 Objetivo do Projeto

O Exa Payment é um sistema completo de pagamentos que demonstra:

- **Clean Architecture** com separação por camadas
- **Observabilidade** com OpenTelemetry + Jaeger
- **Workflows** com Temporal para processos complexos
- **Mensageria** com RabbitMQ para desacoplamento
- **Idempotência** para segurança em pagamentos
- **Tracing distribuído** para visibilidade completa

## 🏗️ Arquitetura

### Stack Principal

- **Backend**: Node.js + NestJS
- **Banco de Dados**: PostgreSQL + Prisma
- **Mensageria**: RabbitMQ
- **Workflows**: Temporal
- **Observabilidade**: OpenTelemetry + Jaeger
- **Auditoria**: MongoDB
- **Testes**: Vitest

### Estrutura do Monorepo

```
exa-payment/
├── apps/                    # Aplicações principais
│   ├── api/                # API NestJS (porta 5050)
│   └── consumer/           # Consumer de eventos (porta 5051)
├── libs/                   # Bibliotecas compartilhadas
│   ├── config/             # Configurações centralizadas
│   ├── contracts/          # Interfaces e DTOs
│   └── testing/            # Utilitários de teste
├── dev/                    # Infraestrutura local
│   └── docker-compose.yml  # Serviços: Postgres, RabbitMQ, Temporal, MongoDB, Jaeger
├── docs/                   # Documentação
│   ├── Postman-Collection.json
│   └── Postman-Environment.json
├── package.json            # Dependências centralizadas
├── nest-cli.json          # Configuração NestJS
├── run                    # Script de automação
└── tsconfig.*.json        # Configurações TypeScript
```

## 🚀 Pré-requisitos

Antes de iniciar, certifique-se de que você possui:

- **Node.js** v22.14.0 (veja `.nvmrc`)
- **Docker** e **Docker Compose**
- **Git**

## 📦 Instalação e Execução

### 1. Clone o Repositório

```bash
git clone <repository-url>
cd exa-payment
```

### 2. Instale as Dependências

```bash
npm install
```

### 3. Configure as Variáveis de Ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite as variáveis conforme necessário
nano .env
```

**Variáveis principais:**

```env
# DOCKER COMPOSE SERVICES
TRACING_ENABLED=true
SERVICE_NAME=exa-payment-api
SERVICE_VERSION=1.0.0
JAEGER_ENDPOINT=http://localhost:14268/api/traces
JAEGER_AGENT_HOST=localhost
JAEGER_AGENT_PORT=14268
```

### 4. Inicie a Infraestrutura

```bash
# Subir todos os serviços (Postgres, RabbitMQ, Temporal, MongoDB, Jaeger)
sh run docker:up

# Ou usando npm
npm run docker:up
```

### 5. Execute as Migrações

```bash
# Gerar cliente Prisma
sh run prisma:generate

# Executar migrações
sh run prisma:migrate

# Popular banco com dados de teste (opcional)
sh run prisma:seed
```

### 6. Inicie as Aplicações

**Opção 1: API apenas**

```bash
sh run start-app api
```

**Opção 2: Consumer apenas**

```bash
sh run start-app consumer
```

**Opção 3: API + Consumer**

```bash
sh run start-app all
```

## 🧪 Testes

### Testes Unitários

```bash
sh run test:unit
```

### Testes E2E

```bash
sh run test:e2e
```

### Testes com Cobertura

```bash
sh run test:cov
```

### Testes em Modo Watch

```bash
sh run test:watch
```

## 🔧 Scripts Disponíveis

### Desenvolvimento

```bash
sh run start-app api        # Inicia API em modo dev
sh run start-app consumer   # Inicia Consumer em modo dev
sh run start-app all        # Inicia API + Consumer
sh run debug api           # Inicia API em modo debug
sh run debug consumer      # Inicia Consumer em modo debug
sh run debug all           # Inicia API + Consumer em modo debug
```

### Infraestrutura

```bash
sh run docker:up           # Sobe infraestrutura Docker
sh run docker:down         # Para infraestrutura Docker
sh run jaeger:start        # Inicia apenas Jaeger
sh run jaeger:stop         # Para Jaeger
```

### Banco de Dados

```bash
sh run prisma:generate     # Gera cliente Prisma
sh run prisma:migrate      # Executa migrações
sh run prisma:seed         # Popula banco com dados de teste
sh run prisma:studio       # Abre Prisma Studio
```

### Observabilidade

```bash
sh run tracing:test        # Testa configuração de tracing
```

### Qualidade de Código

```bash
sh run lint                # Executa lint
sh run format              # Formata código
```

## 🌐 UIs de Infraestrutura

Após subir a infraestrutura (`sh run docker:up`), acesse:

- **API**: http://localhost:5050
- **Consumer**: http://localhost:5051
- **RabbitMQ Management**: http://localhost:15674 (app/app)
- **Temporal UI**: http://localhost:8080
- **Jaeger UI**: http://localhost:16686
- **MongoDB**: mongodb://app:app@localhost:27017/payments_audit

## 📊 Fluxo de Pagamento

### 1. Criação de Pagamento

```bash
POST /api/payment
{
  "cpf": "11144477735",
  "description": "Teste de pagamento",
  "amount": 100.00,
  "paymentMethod": "PIX" | "CREDIT_CARD"
}
```

### 2. Webhook Mercado Pago

```bash
POST /webhook/mercado-pago
{
  "id": 999999999,
  "live_mode": false,
  "type": "payment",
  "data": {
    "id": "999999999",
    "status": "approved",
    "external_reference": "payment-uuid-123",
    "transaction_amount": 100.00
  }
}
```

### 3. Consulta de Status

```bash
GET /api/payment/{id}
```

## 🧪 Testando com Postman

1. **Importe as coleções**:
   - `docs/Postman-Collection.json`
   - `docs/Postman-Environment.json`

2. **Execute o fluxo completo**:
   - Create PIX Payment
   - Create CREDIT_CARD Payment
   - Webhook Approved/Rejected
   - Get Payment by ID
   - List Payments

## 🔍 Observabilidade

### Jaeger Tracing

- **URL**: http://localhost:16686
- **Service**: `exa-payment-api`
- **Spans**: Use case, DB, Provider, Messaging, Workflow

### Logs Estruturados

- **API**: Logs JSON com tracing context
- **Consumer**: Logs de processamento de eventos
- **Temporal**: Logs de workflows e atividades

## 📁 Estrutura de Diretórios

```
apps/
├── api/                    # API NestJS
│   ├── src/
│   │   ├── interfaces/     # Controllers, DTOs, Validações
│   │   ├── application/    # Use cases, Ports, Mappers
│   │   ├── domain/         # Entidades, Value Objects, Serviços
│   │   └── infra/          # DB, Providers, Messaging, Tracing
│   └── prisma/            # Schema e migrações
└── consumer/              # Consumer de eventos
    ├── src/
    │   ├── consumers/     # Event consumers
    │   ├── services/      # Audit, Notification, Analytics
    │   └── schemas/       # MongoDB schemas
```

## 🛠️ Tecnologias Utilizadas

- **NestJS**: Framework Node.js com DI nativa
- **PostgreSQL**: Banco relacional principal
- **Prisma**: ORM com tipagem forte
- **RabbitMQ**: Mensageria assíncrona
- **Temporal**: Orquestração de workflows
- **MongoDB**: Banco de auditoria e analytics
- **OpenTelemetry**: Observabilidade padronizada
- **Jaeger**: Tracing distribuído
- **Vitest**: Framework de testes moderno
- **Docker**: Containerização e ambiente local

## 🚀 Próximos Passos

- [ ] Aumentar cobertura E2E e performance tests
- [ ] Expor dashboards (Grafana/Tempo/Loki)
- [ ] Evoluir consumer para analytics avançados
- [ ] Feature flags e circuit breakers
- [ ] Métricas e alertas

## 📚 Documentação Adicional

- **Apresentação Completa**: `docs/PROJECT-PRESENTATION.md`
- **Coleção Postman**: `docs/Postman-Collection.json`
- **Ambiente Postman**: `docs/Postman-Environment.json`

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

**Desenvolvido com ❤️ para demonstrar boas práticas de arquitetura e observabilidade**
