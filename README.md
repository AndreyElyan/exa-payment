# Payments Monorepo

Sistema de pagamentos com Clean Architecture, DDD e observabilidade completa.

## 🚀 Quickstart

```bash
# 1. Instalar dependências
pnpm i

# 2. Subir infraestrutura local
pnpm docker:up

# 3. Configurar banco de dados
pnpm db:migrate && pnpm db:seed

# 4. Rodar aplicação
pnpm dev

# 5. Executar testes
pnpm test
pnpm test:e2e
```

## 📁 Estrutura do Projeto

```
.
├─ apps/
│  ├─ api/                 # NestJS principal
│  └─ consumer/            # consumer de eventos
├─ packages/
│  ├─ contracts/           # OpenAPI + schemas compartilhados
│  ├─ config/              # loaders de env, logger
│  └─ testing/             # helpers de teste
├─ dev/
│  └─ docker-compose.yml   # postgres, rabbitmq, jaeger
└─ .husky/                 # ganchos de commit
```

## 🛠️ Scripts Disponíveis

- `pnpm dev` - Roda todos os apps em modo desenvolvimento
- `pnpm build` - Build de todos os projetos
- `pnpm test` - Executa testes unitários
- `pnpm test:e2e` - Executa testes end-to-end
- `pnpm lint` - Lint em todos os projetos
- `pnpm format` - Formatação com Prettier
- `pnpm docker:up` - Sobe infraestrutura local
- `pnpm docker:down` - Para infraestrutura local

## 🐳 Infraestrutura Local

- **PostgreSQL**: `localhost:5434`
- **RabbitMQ Management**: `http://localhost:15674` (app/app)
- **Jaeger**: `http://localhost:16688`

## 🧪 Testes

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test --coverage
```

## 📋 Troubleshooting

### Erro de conexão com banco

```bash
pnpm docker:down
pnpm docker:up
```

### Dependências desatualizadas

```bash
pnpm install --frozen-lockfile
```

### Problemas de cache

```bash
pnpm clean
turbo clean
```

## 🏗️ Arquitetura

- **Clean Architecture** com separação de camadas
- **DDD Light** com agregados e eventos de domínio
- **Ports & Adapters** para provedores de pagamento
- **Máquina de estados** para controle de fluxo
- **Idempotência** com chaves únicas
- **Observabilidade** com OpenTelemetry

## 📊 Observabilidade

- **Logs estruturados** em JSON
- **Tracing distribuído** com Jaeger
- **Métricas** de performance e negócio
- **Health checks** para monitoramento

## 🔒 Segurança

- **Validação de entrada** com Zod
- **Headers de idempotência** obrigatórios
- **Webhooks seguros** com assinatura
- **Secrets** via variáveis de ambiente

## 📈 Performance

- **Cache incremental** com Turborepo
- **Build paralelo** otimizado
- **Lazy loading** de dependências
- **Tree shaking** automático
