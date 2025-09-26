.PHONY: help install dev build test test-e2e lint format clean docker-up docker-down db-migrate db-seed

help: ## Mostra esta ajuda
	@echo "Comandos disponíveis:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Instala todas as dependências
	pnpm install

dev: ## Roda todos os apps em modo desenvolvimento
	pnpm dev

build: ## Build de todos os projetos
	pnpm build

test: ## Executa testes unitários
	pnpm test

test-e2e: ## Executa testes end-to-end
	pnpm test:e2e

lint: ## Executa lint em todos os projetos
	pnpm lint

format: ## Formata código com Prettier
	pnpm format

clean: ## Limpa caches e builds
	pnpm clean
	turbo clean

docker-up: ## Sobe infraestrutura local
	pnpm docker:up

docker-down: ## Para infraestrutura local
	pnpm docker:down

db-migrate: ## Executa migrações do banco
	pnpm db:migrate

db-seed: ## Popula banco com dados de teste
	pnpm db:seed

setup: install docker-up db-migrate db-seed ## Setup completo do ambiente

ci: lint test test-e2e ## Pipeline de CI local
