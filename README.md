# 💳 Exa Payment - Sistema de Pagamentos

Sistema de pagamentos desenvolvido com Clean Architecture, DDD e NestJS, seguindo as melhores práticas de desenvolvimento.

## 🚀 Quick Start

### 1. Configuração Inicial

```bash
# Instalar dependências
pnpm install

# Subir banco de dados
pnpm docker:up

# Executar migrações
pnpm prisma:migrate

# Popular com dados iniciais
pnpm prisma:seed
```

### 2. Desenvolvimento

```bash
# Iniciar API em modo desenvolvimento
pnpm dev

# Executar testes
pnpm test

# Executar testes E2E
pnpm test:e2e
```

## 🏗️ Arquitetura

### Clean Architecture + DDD

```
src/
├── interfaces/     # Controllers, DTOs, Filters
├── application/    # Use Cases, Ports, Mappers
├── domain/         # Entities, Value Objects, Rules
└── infra/         # Database, Providers, Messaging
```

### Tecnologias

- **Framework**: NestJS
- **Database**: PostgreSQL + Prisma ORM
- **Messaging**: RabbitMQ
- **Observability**: OpenTelemetry + Jaeger
- **Testing**: Jest + Supertest
- **Container**: Docker + Docker Compose

## 📊 Banco de Dados

### Modelos Principais

- **Payment**: Gestão de pagamentos (PIX/Cartão)
- **IdempotencyKey**: Controle de idempotência

### Comandos Úteis

```bash
# Visualizar dados
npx prisma studio --port 5555

# Resetar banco
npx prisma migrate reset

# Aplicar mudanças no schema
npx prisma db push
```

## 🔧 Serviços Disponíveis

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| API | 3000 | Aplicação principal |
| PostgreSQL | 5433 | Banco de dados |
| RabbitMQ | 5672 | Mensageria |
| RabbitMQ Management | 15672 | Interface web |
| Jaeger | 16686 | Tracing |
| Prisma Studio | 5555 | Interface do banco |

## 📋 Histórias Implementadas

### ✅ História 0.3 - Configuração de Banco de Dados

**Critérios de Aceitação:**
- ✅ docker-compose.yml com serviço postgres
- ✅ Prisma configurado com schema inicial
- ✅ Script pnpm prisma:migrate dev

**Funcionalidades:**
- PostgreSQL 15 Alpine configurado
- Schema com modelos Payment e IdempotencyKey
- Índices otimizados para performance
- Scripts de migração e seed
- Configuração de ambiente completa

## 🧪 Testes

```bash
# Testes unitários
pnpm test

# Testes de integração
pnpm test:e2e

# Cobertura de código
pnpm test:cov
```

## 📚 Documentação

- [Configuração do Banco](docs/database-setup.md)
- [Clean Architecture](docs/adr-001-clean-architecture.md)
- [Máquina de Estados](docs/adr-002-state-machine.md)
- [Decisões de Banco](docs/adr-003-database.md)

## 🚀 Deploy

### Docker Compose

```bash
# Subir todos os serviços
docker compose up -d

# Parar serviços
docker compose down

# Ver logs
docker compose logs -f
```

### Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure as variáveis necessárias.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.