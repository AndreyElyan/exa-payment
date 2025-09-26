#!/usr/bin/env bash
export USERID="$(id -u)"

NPM="npm"
NEST="npx nest"
NPX="npx"
ENV_FILE=".env"
ENV_FILE_EXAMPLE=".env.example"
ICON="🤖"

project_dir=$(pwd)

show_commands () {
    echo
    echo "$ICON Comandos disponíveis:"
    echo
    echo "sh dev start-app api     - Inicia a API em modo Dev"
    echo "sh dev debug api         - Inicia a API em modo debug"
    echo "sh dev build             - Builda a aplicação"
    echo "sh dev test              - Executa todos os testes"
    echo "sh dev test:unit         - Executa testes unitários"
    echo "sh dev test:e2e          - Executa testes e2e"
    echo "sh dev test:cov          - Executa testes com cobertura"
    echo "sh dev test:watch        - Executa testes em modo watch"
    echo "sh dev lint              - Executa lint"
    echo "sh dev format            - Formata código"
    echo "sh dev docker:up         - Sobe infraestrutura Docker"
    echo "sh dev docker:down       - Para infraestrutura Docker"
    echo
}

devops_start () {
    echo "$ICON Iniciando infraestrutura Docker..."
    npm run docker:up
}

execute_npm_install () {
    echo "$ICON Instalando dependências..."
    npm install
}

start_app () {
    APP=$2

    if [ -z "$APP" ] || [ "$APP" != "api" ]; then
        echo "$ICON Use: sh dev start-app api"
        exit 1
    fi

    devops_start
    execute_npm_install

    echo "$ICON Iniciando API em modo desenvolvimento..."
    npx nest start api --watch
}

debug () {
    APP=$2

    if [ -z "$APP" ] || [ "$APP" != "api" ]; then
        echo "$ICON Use: sh dev debug api"
        exit 1
    fi

    devops_start
    execute_npm_install

    echo "$ICON Iniciando API em modo debug..."
    npx nest start api --debug
}

build_app () {
    echo "$ICON Buildando aplicação..."
    npm run build
}

test_app () {
    echo "$ICON Executando todos os testes..."
    npm run test
}

test_unit () {
    echo "$ICON Executando testes unitários..."
    npm run test:unit
}

test_e2e () {
    echo "$ICON Executando testes e2e..."
    npm run test:e2e
}

test_coverage () {
    echo "$ICON Executando testes com cobertura..."
    npm run test:cov
}

test_watch () {
    echo "$ICON Executando testes em modo watch..."
    npm run test:watch
}

lint_app () {
    echo "$ICON Executando lint..."
    npm run lint
}

format_app () {
    echo "$ICON Formatando código..."
    npm run format
}

docker_up () {
    echo "$ICON Subindo infraestrutura Docker..."
    npm run docker:up
}

docker_down () {
    echo "$ICON Parando infraestrutura Docker..."
    npm run docker:down
}

if [ $# -gt 0 ]; then
    case "$1" in
      "start-app") start_app "$@" ;;
      "debug") debug "$@" ;;
      "build") build_app "$@" ;;
      "test") test_app "$@" ;;
      "test:unit") test_unit "$@" ;;
      "test:e2e") test_e2e "$@" ;;
      "test:cov") test_coverage "$@" ;;
      "test:watch") test_watch "$@" ;;
      "lint") lint_app "$@" ;;
      "format") format_app "$@" ;;
      "docker:up") docker_up "$@" ;;
      "docker:down") docker_down "$@" ;;
    *) show_commands ;;
    esac
else
    show_commands
fi
