.PHONY: help install dev build test test-e2e lint format clean docker-up docker-down db-migrate db-seed start-app debug

help: ## Mostra esta ajuda
	@echo "Comandos disponíveis:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Instala todas as dependências
	npm install

dev: ## Roda todos os apps em modo desenvolvimento
	npm run dev

start-app: ## Inicia a API em modo desenvolvimento
	npm run docker:up
	npm install
	npx nest start api --watch

debug: ## Inicia a API em modo debug
	npm run docker:up
	npm install
	npx nest start api --debug

build: ## Build de todos os projetos
	npm run build

test: ## Executa todos os testes
	npm run test

test-unit: ## Executa testes unitários
	npm run test:unit

test-e2e: ## Executa testes end-to-end
	npm run test:e2e

test-cov: ## Executa testes com cobertura
	npm run test:cov

test-watch: ## Executa testes em modo watch
	npm run test:watch

lint: ## Executa lint em todos os projetos
	npm run lint

format: ## Formata código com Prettier
	npm run format

clean: ## Limpa caches e builds
	rm -rf dist
	rm -rf node_modules/.cache

docker-up: ## Sobe infraestrutura local
	npm run docker:up

docker-down: ## Para infraestrutura local
	npm run docker:down

db-migrate: ## Executa migrações do banco
	cd apps/api && npx prisma migrate dev

db-seed: ## Popula banco com dados de teste
	cd apps/api && npx prisma db seed

setup: install docker-up db-migrate db-seed ## Setup completo do ambiente

ci: lint test test-e2e ## Pipeline de CI local
