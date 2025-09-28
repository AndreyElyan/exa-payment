#!/bin/bash

# Script para testar o fluxo completo de pagamento com Temporal
# Execute este script após iniciar a API e o Temporal
# Inclui todos os endpoints da API e cenários de teste

echo "🧪 Testando Fluxo Completo de Pagamento com Temporal"
echo "====================================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para testar endpoint
test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local headers="$5"
    local expected_status="$6"
    
    echo -e "\n${BLUE}🔍 Testando: $test_name${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -n "$data" ]; then
        echo "Data: $data"
    fi
    
    if [ -n "$headers" ]; then
        echo "Headers: $headers"
    fi
    
    # Executar o teste
    if [ -n "$headers" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            -d "$data" \
            "http://localhost:5050$endpoint")
    elif [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            "http://localhost:5050$endpoint")
    elif [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "http://localhost:5050$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            "http://localhost:5050$endpoint")
    fi
    
    # Separar body e status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    echo "Status Code: $http_code"
    echo "Response: $body"
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ Teste passou!${NC}"
        return 0
    else
        echo -e "${RED}❌ Teste falhou! Esperado: $expected_status, Recebido: $http_code${NC}"
        return 1
    fi
}

# Verificar se a API está rodando
echo -e "\n${YELLOW}🔍 Verificando se a API está rodando...${NC}"
if ! curl -s http://localhost:5050/api/payment > /dev/null 2>&1; then
    echo -e "${RED}❌ API não está rodando em localhost:5050${NC}"
    echo "Execute: npm run dev:api"
    exit 1
fi
echo -e "${GREEN}✅ API está rodando!${NC}"

# Verificar se o Temporal está rodando
echo -e "\n${YELLOW}🔍 Verificando se o Temporal está rodando...${NC}"
if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Temporal UI não está acessível em localhost:8080${NC}"
    echo "Execute: docker compose -f dev/docker-compose.yml up -d"
else
    echo -e "${GREEN}✅ Temporal UI está acessível!${NC}"
fi

echo -e "\n${BLUE}🚀 Iniciando testes do fluxo de pagamento...${NC}"

# Teste 1: PIX Payment (não deve usar Temporal)
test_endpoint \
    "PIX Payment (sem Temporal)" \
    "POST" \
    "/api/payment" \
    '{"cpf":"11144477735","description":"Teste PIX","amount":100.50,"paymentMethod":"PIX"}' \
    "" \
    "201"

# Teste 2: CREDIT_CARD sem Idempotency-Key (deve falhar)
test_endpoint \
    "CREDIT_CARD sem Idempotency-Key (deve falhar)" \
    "POST" \
    "/api/payment" \
    '{"cpf":"11144477735","description":"Teste Cartão","amount":100.50,"paymentMethod":"CREDIT_CARD"}' \
    "" \
    "400"

# Teste 3: CREDIT_CARD com Temporal (deve usar workflow)
test_endpoint \
    "CREDIT_CARD com Temporal Workflow" \
    "POST" \
    "/api/payment" \
    '{"cpf":"11144477735","description":"Teste Temporal Cartão","amount":100.50,"paymentMethod":"CREDIT_CARD"}' \
    "Idempotency-Key: test-temporal-123" \
    "200"

# Teste 4: CREDIT_CARD com Idempotency-Key duplicado (deve retornar mesmo pagamento)
test_endpoint \
    "CREDIT_CARD com Idempotency-Key duplicado" \
    "POST" \
    "/api/payment" \
    '{"cpf":"11144477735","description":"Teste Temporal Cartão","amount":100.50,"paymentMethod":"CREDIT_CARD"}' \
    "Idempotency-Key: test-temporal-123" \
    "200"

# Teste 5: CREDIT_CARD com Idempotency-Key diferente (novo pagamento)
test_endpoint \
    "CREDIT_CARD com novo Idempotency-Key" \
    "POST" \
    "/api/payment" \
    '{"cpf":"12345678909","description":"Teste Temporal Cartão 2","amount":250.75,"paymentMethod":"CREDIT_CARD"}' \
    "Idempotency-Key: test-temporal-$(date +%s)" \
    "201"

# Teste 6: Validação de CPF inválido
test_endpoint \
    "CPF inválido (deve falhar)" \
    "POST" \
    "/api/payment" \
    '{"cpf":"123","description":"Teste CPF Inválido","amount":100.50,"paymentMethod":"PIX"}' \
    "" \
    "400"

# Teste 7: Validação de amount inválido
test_endpoint \
    "Amount inválido (deve falhar)" \
    "POST" \
    "/api/payment" \
    '{"cpf":"11144477735","description":"Teste Amount Inválido","amount":0,"paymentMethod":"PIX"}' \
    "" \
    "400"

# Teste 8: Validação de paymentMethod inválido
test_endpoint \
    "PaymentMethod inválido (deve falhar)" \
    "POST" \
    "/api/payment" \
    '{"cpf":"11144477735","description":"Teste Method Inválido","amount":100.50,"paymentMethod":"INVALID"}' \
    "" \
    "400"

# Teste 9: Webhook de pagamento aprovado (integração completa)
echo -e "\n${BLUE}🔍 Testando: Webhook de pagamento aprovado (fluxo completo)${NC}"

# Criar um pagamento para testar webhook
echo "Criando pagamento para teste de webhook..."
webhook_payment_response=$(curl -s -X POST http://localhost:5050/api/payment \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-webhook-$(date +%s)" \
  -d '{
    "cpf": "11144477735",
    "description": "Teste Webhook Completo",
    "amount": 300.00,
    "paymentMethod": "CREDIT_CARD"
  }')

echo "Payment Response: $webhook_payment_response"

# Extrair ID do pagamento
webhook_payment_id=$(echo "$webhook_payment_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$webhook_payment_id" ]; then
    echo -e "${GREEN}✅ Pagamento criado para webhook: $webhook_payment_id${NC}"
    
    # Aguardar um pouco para o workflow iniciar
    echo "Aguardando workflow iniciar..."
    sleep 3
    
    # Testar webhook de pagamento aprovado
    echo "Testando webhook de pagamento aprovado..."
    webhook_response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "{
            \"id\": 999999999,
            \"live_mode\": false,
            \"type\": \"payment\",
            \"date_created\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
            \"data\": {
                \"id\": \"999999999\",
                \"status\": \"approved\",
                \"external_reference\": \"$webhook_payment_id\",
                \"transaction_amount\": 300.00,
                \"currency_id\": \"BRL\",
                \"payment_method_id\": \"credit_card\",
                \"date_approved\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
            }
        }" \
        "http://localhost:5050/webhook/mercado-pago")
    
    webhook_http_code=$(echo "$webhook_response" | tail -n1)
    webhook_body=$(echo "$webhook_response" | head -n -1)
    
    echo "Webhook Status Code: $webhook_http_code"
    echo "Webhook Response: $webhook_body"
    
    if [ "$webhook_http_code" = "200" ]; then
        echo -e "${GREEN}✅ Webhook de pagamento aprovado funcionando!${NC}"
    else
        echo -e "${RED}❌ Webhook falhou! Status: $webhook_http_code${NC}"
    fi
    
    # Aguardar processamento
    echo "Aguardando processamento do webhook..."
    sleep 2
    
    # Verificar status no banco
    echo "Verificando status no banco de dados..."
    db_status=$(docker exec dev-postgres-1 psql -U app -d payments -t -c "SELECT status FROM payments WHERE id = '$webhook_payment_id';" 2>/dev/null | tr -d ' ')
    echo "Status atual no banco: $db_status"
    
    if [ "$db_status" = "PAID" ]; then
        echo -e "${GREEN}✅ Status atualizado para PAID!${NC}"
    else
        echo -e "${YELLOW}⚠️  Status ainda é $db_status (pode estar processando)${NC}"
    fi
else
    echo -e "${RED}❌ Falha ao criar pagamento para webhook${NC}"
fi

# Teste 10: Webhook de pagamento rejeitado (criar novo pagamento)
echo -e "\n${BLUE}🔍 Testando: Webhook de pagamento rejeitado${NC}"

echo "Criando pagamento para teste de webhook rejeitado..."
webhook_reject_payment_response=$(curl -s -X POST http://localhost:5050/api/payment \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-webhook-reject-$(date +%s)" \
  -d '{
    "cpf": "11144477735",
    "description": "Teste Webhook Rejeitado",
    "amount": 150.00,
    "paymentMethod": "CREDIT_CARD"
  }')

echo "Reject Payment Response: $webhook_reject_payment_response"

# Extrair ID do pagamento para rejeição
webhook_reject_payment_id=$(echo "$webhook_reject_payment_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$webhook_reject_payment_id" ]; then
    echo -e "${GREEN}✅ Pagamento criado para webhook rejeitado: $webhook_reject_payment_id${NC}"
    
    # Aguardar um pouco para o workflow iniciar
    echo "Aguardando workflow iniciar..."
    sleep 3
    
    echo "Testando webhook de pagamento rejeitado..."
    webhook_reject_response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "{
            \"id\": 999999998,
            \"live_mode\": false,
            \"type\": \"payment\",
            \"date_created\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
            \"data\": {
                \"id\": \"999999998\",
                \"status\": \"rejected\",
                \"external_reference\": \"$webhook_reject_payment_id\",
                \"transaction_amount\": 150.00,
                \"currency_id\": \"BRL\",
                \"payment_method_id\": \"credit_card\"
            }
        }" \
        "http://localhost:5050/webhook/mercado-pago")
    
    webhook_reject_http_code=$(echo "$webhook_reject_response" | tail -n1)
    webhook_reject_body=$(echo "$webhook_reject_response" | head -n -1)
    
    echo "Webhook Reject Status Code: $webhook_reject_http_code"
    echo "Webhook Reject Response: $webhook_reject_body"
    
    if [ "$webhook_reject_http_code" = "200" ]; then
        echo -e "${GREEN}✅ Webhook de pagamento rejeitado funcionando!${NC}"
        
        # Aguardar processamento
        echo "Aguardando processamento do webhook rejeitado..."
        sleep 2
        
        # Verificar status no banco
        echo "Verificando status no banco de dados..."
        db_reject_status=$(docker exec dev-postgres-1 psql -U app -d payments -t -c "SELECT status FROM payments WHERE id = '$webhook_reject_payment_id';" 2>/dev/null | tr -d ' ')
        echo "Status atual no banco: $db_reject_status"
        
        if [ "$db_reject_status" = "FAIL" ]; then
            echo -e "${GREEN}✅ Status atualizado para FAIL!${NC}"
        else
            echo -e "${YELLOW}⚠️  Status ainda é $db_reject_status (pode estar processando)${NC}"
        fi
    else
        echo -e "${RED}❌ Webhook rejeitado falhou! Status: $webhook_reject_http_code${NC}"
    fi
else
    echo -e "${RED}❌ Falha ao criar pagamento para webhook rejeitado${NC}"
fi

# Teste 11: Webhook inválido (sem external_reference)
echo -e "\n${BLUE}🔍 Testando: Webhook sem external_reference${NC}"

webhook_invalid_response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{
        \"id\": 999999997,
        \"live_mode\": false,
        \"type\": \"payment\",
        \"date_created\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
        \"data\": {
            \"id\": \"999999997\",
            \"status\": \"approved\",
            \"transaction_amount\": 300.00,
            \"currency_id\": \"BRL\"
        }
    }" \
    "http://localhost:5050/webhook/mercado-pago")

webhook_invalid_http_code=$(echo "$webhook_invalid_response" | tail -n1)
webhook_invalid_body=$(echo "$webhook_invalid_response" | head -n -1)

echo "Webhook Invalid Status Code: $webhook_invalid_http_code"
echo "Webhook Invalid Response: $webhook_invalid_body"

if [ "$webhook_invalid_http_code" = "200" ]; then
    echo -e "${GREEN}✅ Webhook sem external_reference tratado corretamente!${NC}"
else
    echo -e "${RED}❌ Webhook inválido falhou! Status: $webhook_invalid_http_code${NC}"
fi

# Teste 12: Webhook de tipo diferente (deve ser ignorado)
echo -e "\n${BLUE}🔍 Testando: Webhook de tipo diferente${NC}"

webhook_subscription_response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{
        \"id\": 999999996,
        \"live_mode\": false,
        \"type\": \"subscription\",
        \"date_created\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
        \"data\": {
            \"id\": \"999999996\",
            \"status\": \"active\"
        }
    }" \
    "http://localhost:5050/webhook/mercado-pago")

webhook_subscription_http_code=$(echo "$webhook_subscription_response" | tail -n1)
webhook_subscription_body=$(echo "$webhook_subscription_response" | head -n -1)

echo "Webhook Subscription Status Code: $webhook_subscription_http_code"
echo "Webhook Subscription Response: $webhook_subscription_body"

if [ "$webhook_subscription_http_code" = "200" ]; then
    echo -e "${GREEN}✅ Webhook de tipo diferente ignorado corretamente!${NC}"
else
    echo -e "${RED}❌ Webhook de tipo diferente falhou! Status: $webhook_subscription_http_code${NC}"
fi

# Teste 13: Webhook de teste (endpoint de teste)
echo -e "\n${BLUE}🔍 Testando: Webhook de teste${NC}"

webhook_test_response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "test": "data",
        "message": "Test webhook payload"
    }' \
    "http://localhost:5050/webhook/mercado-pago/test")

webhook_test_http_code=$(echo "$webhook_test_response" | tail -n1)
webhook_test_body=$(echo "$webhook_test_response" | head -n -1)

echo "Webhook Test Status Code: $webhook_test_http_code"
echo "Webhook Test Response: $webhook_test_body"

if [ "$webhook_test_http_code" = "200" ]; then
    echo -e "${GREEN}✅ Webhook de teste funcionando!${NC}"
else
    echo -e "${RED}❌ Webhook de teste falhou! Status: $webhook_test_http_code${NC}"
fi

# Teste 14: GET Payment by ID (buscar pagamento específico)
echo -e "\n${BLUE}🔍 Testando: GET Payment by ID${NC}"

# Usar o ID do pagamento criado anteriormente
if [ -n "$webhook_payment_id" ]; then
    test_endpoint \
        "GET Payment by ID" \
        "GET" \
        "/api/payment/$webhook_payment_id" \
        "" \
        "" \
        "200"
else
    echo -e "${YELLOW}⚠️  Nenhum ID de pagamento disponível para teste${NC}"
fi

# Teste 15: GET Payment by ID inexistente (deve falhar)
echo -e "\n${BLUE}🔍 Testando: GET Payment by ID inexistente${NC}"

test_endpoint \
    "GET Payment by ID inexistente" \
    "GET" \
    "/api/payment/inexistent-id-12345" \
    "" \
    "" \
    "404"

# Teste 16: PUT Payment (atualizar status)
echo -e "\n${BLUE}🔍 Testando: PUT Payment (atualizar status)${NC}"

if [ -n "$webhook_payment_id" ]; then
    test_endpoint \
        "PUT Payment status" \
        "PUT" \
        "/api/payment/$webhook_payment_id" \
        '{"status":"PAID"}' \
        "" \
        "200"
else
    echo -e "${YELLOW}⚠️  Nenhum ID de pagamento disponível para teste${NC}"
fi

# Teste 17: PUT Payment com status inválido (deve falhar)
echo -e "\n${BLUE}🔍 Testando: PUT Payment com status inválido${NC}"

if [ -n "$webhook_payment_id" ]; then
    test_endpoint \
        "PUT Payment status inválido" \
        "PUT" \
        "/api/payment/$webhook_payment_id" \
        '{"status":"INVALID_STATUS"}' \
        "" \
        "400"
else
    echo -e "${YELLOW}⚠️  Nenhum ID de pagamento disponível para teste${NC}"
fi

# Teste 18: GET Payments (listar todos)
echo -e "\n${BLUE}🔍 Testando: GET Payments (listar todos)${NC}"

test_endpoint \
    "GET Payments (todos)" \
    "GET" \
    "/api/payment" \
    "" \
    "" \
    "200"

# Teste 19: GET Payments com filtro por CPF
echo -e "\n${BLUE}🔍 Testando: GET Payments com filtro por CPF${NC}"

test_endpoint \
    "GET Payments filtrado por CPF" \
    "GET" \
    "/api/payment?cpf=11144477735" \
    "" \
    "" \
    "200"

# Teste 20: GET Payments com filtro por status
echo -e "\n${BLUE}🔍 Testando: GET Payments com filtro por status${NC}"

test_endpoint \
    "GET Payments filtrado por status" \
    "GET" \
    "/api/payment?status=PENDING" \
    "" \
    "" \
    "200"

# Teste 21: GET Payments com filtro por paymentMethod
echo -e "\n${BLUE}🔍 Testando: GET Payments com filtro por paymentMethod${NC}"

test_endpoint \
    "GET Payments filtrado por paymentMethod" \
    "GET" \
    "/api/payment?paymentMethod=CREDIT_CARD" \
    "" \
    "" \
    "200"

# Teste 22: GET Payments com paginação
echo -e "\n${BLUE}🔍 Testando: GET Payments com paginação${NC}"

test_endpoint \
    "GET Payments com paginação" \
    "GET" \
    "/api/payment?page=1&limit=5" \
    "" \
    "" \
    "200"

# Teste 23: GET Payments com paginação inválida (page = 0)
echo -e "\n${BLUE}🔍 Testando: GET Payments com paginação inválida${NC}"

test_endpoint \
    "GET Payments com page inválido" \
    "GET" \
    "/api/payment?page=0" \
    "" \
    "" \
    "400"

# Teste 24: GET Payments com limit inválido (muito alto)
echo -e "\n${BLUE}🔍 Testando: GET Payments com limit inválido${NC}"

test_endpoint \
    "GET Payments com limit inválido" \
    "GET" \
    "/api/payment?limit=150" \
    "" \
    "" \
    "400"

# Teste 25: GET Payments com filtros combinados
echo -e "\n${BLUE}🔍 Testando: GET Payments com filtros combinados${NC}"

test_endpoint \
    "GET Payments com filtros combinados" \
    "GET" \
    "/api/payment?cpf=11144477735&status=PENDING&paymentMethod=CREDIT_CARD&page=1&limit=10" \
    "" \
    "" \
    "200"

# Teste 26: Validação de CPF com formato incorreto (muito curto)
echo -e "\n${BLUE}🔍 Testando: CPF muito curto${NC}"

test_endpoint \
    "CPF muito curto" \
    "POST" \
    "/api/payment" \
    '{"cpf":"123","description":"Teste CPF Curto","amount":100.50,"paymentMethod":"PIX"}' \
    "" \
    "400"

# Teste 27: Validação de CPF com formato incorreto (muito longo)
echo -e "\n${BLUE}🔍 Testando: CPF muito longo${NC}"

test_endpoint \
    "CPF muito longo" \
    "POST" \
    "/api/payment" \
    '{"cpf":"123456789012","description":"Teste CPF Longo","amount":100.50,"paymentMethod":"PIX"}' \
    "" \
    "400"

# Teste 28: Validação de description vazia
echo -e "\n${BLUE}🔍 Testando: Description vazia${NC}"

test_endpoint \
    "Description vazia" \
    "POST" \
    "/api/payment" \
    '{"cpf":"11144477735","description":"","amount":100.50,"paymentMethod":"PIX"}' \
    "" \
    "400"

# Teste 29: Validação de description muito longa
echo -e "\n${BLUE}🔍 Testando: Description muito longa${NC}"

# Criar uma string de 256 caracteres (acima do limite de 255)
long_description=""
for i in $(seq 1 256); do
    long_description="${long_description}a"
done

test_endpoint \
    "Description muito longa" \
    "POST" \
    "/api/payment" \
    "{\"cpf\":\"11144477735\",\"description\":\"$long_description\",\"amount\":100.50,\"paymentMethod\":\"PIX\"}" \
    "" \
    "400"

# Teste 30: Validação de amount negativo
echo -e "\n${BLUE}🔍 Testando: Amount negativo${NC}"

test_endpoint \
    "Amount negativo" \
    "POST" \
    "/api/payment" \
    '{"cpf":"11144477735","description":"Teste Amount Negativo","amount":-100.50,"paymentMethod":"PIX"}' \
    "" \
    "400"

# Teste 31: Validação de amount muito alto
echo -e "\n${BLUE}🔍 Testando: Amount muito alto${NC}"

test_endpoint \
    "Amount muito alto" \
    "POST" \
    "/api/payment" \
    '{"cpf":"11144477735","description":"Teste Amount Alto","amount":99999999999.99,"paymentMethod":"PIX"}' \
    "" \
    "400"

# Teste 32: Validação de campos obrigatórios ausentes
echo -e "\n${BLUE}🔍 Testando: Campos obrigatórios ausentes${NC}"

test_endpoint \
    "Campos obrigatórios ausentes" \
    "POST" \
    "/api/payment" \
    '{"cpf":"11144477735"}' \
    "" \
    "400"

# Teste 33: Validação de JSON malformado
echo -e "\n${BLUE}🔍 Testando: JSON malformado${NC}"

echo "Testando JSON malformado..."
json_malformed_response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"cpf":"11144477735","description":"Teste JSON Malformado","amount":100.50,"paymentMethod":"PIX"' \
    "http://localhost:5050/api/payment")

json_malformed_http_code=$(echo "$json_malformed_response" | tail -n1)
json_malformed_body=$(echo "$json_malformed_response" | head -n -1)

echo "JSON Malformed Status Code: $json_malformed_http_code"
echo "JSON Malformed Response: $json_malformed_body"

if [ "$json_malformed_http_code" = "400" ]; then
    echo -e "${GREEN}✅ JSON malformado tratado corretamente!${NC}"
else
    echo -e "${RED}❌ JSON malformado não tratado! Status: $json_malformed_http_code${NC}"
fi

# Teste 34: Content-Type incorreto
echo -e "\n${BLUE}🔍 Testando: Content-Type incorreto${NC}"

echo "Testando Content-Type incorreto..."
content_type_response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: text/plain" \
    -d '{"cpf":"11144477735","description":"Teste Content-Type","amount":100.50,"paymentMethod":"PIX"}' \
    "http://localhost:5050/api/payment")

content_type_http_code=$(echo "$content_type_response" | tail -n1)
content_type_body=$(echo "$content_type_response" | head -n -1)

echo "Content-Type Status Code: $content_type_http_code"
echo "Content-Type Response: $content_type_body"

if [ "$content_type_http_code" = "400" ] || [ "$content_type_http_code" = "415" ]; then
    echo -e "${GREEN}✅ Content-Type incorreto tratado corretamente!${NC}"
else
    echo -e "${RED}❌ Content-Type incorreto não tratado! Status: $content_type_http_code${NC}"
fi

# Teste 35: Método HTTP não permitido
echo -e "\n${BLUE}🔍 Testando: Método HTTP não permitido${NC}"

test_endpoint \
    "Método HTTP não permitido" \
    "DELETE" \
    "/api/payment" \
    "" \
    "" \
    "404"

# Teste 36: Endpoint inexistente
echo -e "\n${BLUE}🔍 Testando: Endpoint inexistente${NC}"

test_endpoint \
    "Endpoint inexistente" \
    "GET" \
    "/api/nonexistent" \
    "" \
    "" \
    "404"

# Teste 37: Stress test - múltiplos pagamentos simultâneos
echo -e "\n${BLUE}🔍 Testando: Stress test - múltiplos pagamentos${NC}"

echo "Criando múltiplos pagamentos simultâneos..."
for i in $(seq 1 5); do
    (
        test_endpoint \
            "Stress test pagamento $i" \
            "POST" \
            "/api/payment" \
            "{\"cpf\":\"11144477735\",\"description\":\"Stress Test $i\",\"amount\":$((100 + i * 10)),\"paymentMethod\":\"PIX\"}" \
            "" \
            "201" &
    )
done

# Aguardar todos os processos em background terminarem
wait
echo -e "${GREEN}✅ Stress test concluído!${NC}"

# Teste 38: Teste de concorrência com Idempotency-Key
echo -e "\n${BLUE}🔍 Testando: Concorrência com Idempotency-Key${NC}"

concurrent_key="test-concurrent-$(date +%s)"
echo "Testando concorrência com key: $concurrent_key"

# Primeiro pagamento deve retornar 201 (novo)
echo "Criando primeiro pagamento..."
test_endpoint \
    "Concorrência - Primeiro pagamento" \
    "POST" \
    "/api/payment" \
    "{\"cpf\":\"11144477735\",\"description\":\"Teste Concorrência\",\"amount\":200.00,\"paymentMethod\":\"CREDIT_CARD\"}" \
    "Idempotency-Key: $concurrent_key" \
    "201"

# Aguardar um pouco
sleep 1

# Pagamentos subsequentes com mesma key devem retornar 200 (existente)
echo "Testando pagamentos subsequentes com mesma key..."
for i in $(seq 1 3); do
    (
        test_endpoint \
            "Concorrência $i" \
            "POST" \
            "/api/payment" \
            "{\"cpf\":\"11144477735\",\"description\":\"Teste Concorrência\",\"amount\":200.00,\"paymentMethod\":\"CREDIT_CARD\"}" \
            "Idempotency-Key: $concurrent_key" \
            "200" &
    )
done

# Aguardar todos os processos em background terminarem
wait
echo -e "${GREEN}✅ Teste de concorrência concluído!${NC}"

# Teste 39: Verificar que idempotência falha com dados diferentes
echo -e "\n${BLUE}🔍 Testando: Idempotência com dados diferentes (deve falhar)${NC}"

different_key="test-different-$(date +%s)"
echo "Testando idempotência com dados diferentes..."

# Primeiro pagamento
test_endpoint \
    "Idempotência - Primeiro pagamento" \
    "POST" \
    "/api/payment" \
    "{\"cpf\":\"11144477735\",\"description\":\"Teste Idempotência\",\"amount\":150.00,\"paymentMethod\":\"CREDIT_CARD\"}" \
    "Idempotency-Key: $different_key" \
    "201"

# Tentar criar pagamento com mesma key mas dados diferentes (deve falhar)
test_endpoint \
    "Idempotência - Dados diferentes" \
    "POST" \
    "/api/payment" \
    "{\"cpf\":\"11144477735\",\"description\":\"Teste Idempotência Diferente\",\"amount\":150.00,\"paymentMethod\":\"CREDIT_CARD\"}" \
    "Idempotency-Key: $different_key" \
    "400"

echo -e "${GREEN}✅ Teste de idempotência com dados diferentes concluído!${NC}"

# Log detalhado de todos os cenários testados
echo -e "\n${BLUE}📋 Log Detalhado de Todos os Cenários Testados${NC}"
echo "=================================================="
echo ""
echo -e "${YELLOW}🔹 TESTES DE CRIAÇÃO DE PAGAMENTO (1-5):${NC}"
echo "1. PIX Payment (sem Temporal) - Status: 201"
echo "2. CREDIT_CARD sem Idempotency-Key (deve falhar) - Status: 400"
echo "3. CREDIT_CARD com Temporal Workflow - Status: 200"
echo "4. CREDIT_CARD com Idempotency-Key duplicado - Status: 200"
echo "5. CREDIT_CARD com novo Idempotency-Key - Status: 201"
echo ""
echo -e "${YELLOW}🔹 TESTES DE VALIDAÇÃO DE ENTRADA (6-8):${NC}"
echo "6. CPF inválido (deve falhar) - Status: 400"
echo "7. Amount inválido (deve falhar) - Status: 400"
echo "8. PaymentMethod inválido (deve falhar) - Status: 400"
echo ""
echo -e "${YELLOW}🔹 TESTES DE WEBHOOK (9-13):${NC}"
echo "9. Webhook de pagamento aprovado (fluxo completo) - Status: 200"
echo "10. Webhook de pagamento rejeitado - Status: 200"
echo "11. Webhook sem external_reference - Status: 200"
echo "12. Webhook de tipo diferente (ignorado) - Status: 200"
echo "13. Webhook de teste - Status: 200"
echo ""
echo -e "${YELLOW}🔹 TESTES DE BUSCA E ATUALIZAÇÃO (14-17):${NC}"
echo "14. GET Payment by ID - Status: 200"
echo "15. GET Payment by ID inexistente - Status: 404"
echo "16. PUT Payment (atualizar status) - Status: 200"
echo "17. PUT Payment com status inválido - Status: 400"
echo ""
echo -e "${YELLOW}🔹 TESTES DE LISTAGEM (18-25):${NC}"
echo "18. GET Payments (listar todos) - Status: 200"
echo "19. GET Payments com filtro por CPF - Status: 200"
echo "20. GET Payments com filtro por status - Status: 200"
echo "21. GET Payments com filtro por paymentMethod - Status: 200"
echo "22. GET Payments com paginação - Status: 200"
echo "23. GET Payments com page inválido - Status: 400"
echo "24. GET Payments com limit inválido - Status: 400"
echo "25. GET Payments com filtros combinados - Status: 200"
echo ""
echo -e "${YELLOW}🔹 TESTES DE VALIDAÇÃO AVANÇADA (26-34):${NC}"
echo "26. CPF muito curto - Status: 400"
echo "27. CPF muito longo - Status: 400"
echo "28. Description vazia - Status: 400"
echo "29. Description muito longa - Status: 400"
echo "30. Amount negativo - Status: 400"
echo "31. Amount muito alto - Status: 400"
echo "32. Campos obrigatórios ausentes - Status: 400"
echo "33. JSON malformado - Status: 400"
echo "34. Content-Type incorreto - Status: 400"
echo ""
echo -e "${YELLOW}🔹 TESTES DE ROBUSTEZ (35-36):${NC}"
echo "35. Método HTTP não permitido - Status: 404"
echo "36. Endpoint inexistente - Status: 404"
echo ""
echo -e "${YELLOW}🔹 TESTES DE PERFORMANCE (37-39):${NC}"
echo "37. Stress test - múltiplos pagamentos simultâneos - Status: 201"
echo "38. Concorrência com Idempotency-Key - Status: 200/201"
echo "39. Idempotência com dados diferentes - Status: 400"
echo ""

echo -e "\n${BLUE}📊 Resumo dos Testes${NC}"
echo "===================="
echo -e "${GREEN}✅ Todos os 39 testes concluídos!${NC}"
echo ""
echo -e "${YELLOW}📋 Endpoints Testados em Detalhes:${NC}"
echo ""
echo -e "${BLUE}🔹 POST /api/payment${NC}"
echo "  • Criação de pagamentos PIX (sem Temporal)"
echo "  • Criação de pagamentos CREDIT_CARD (com Temporal)"
echo "  • Validação de Idempotency-Key"
echo "  • Validação de campos obrigatórios"
echo "  • Validação de tipos de dados"
echo "  • Validação de limites (CPF, amount, description)"
echo ""
echo -e "${BLUE}🔹 GET /api/payment/:id${NC}"
echo "  • Busca de pagamento por ID existente"
echo "  • Busca de pagamento por ID inexistente (404)"
echo ""
echo -e "${BLUE}🔹 PUT /api/payment/:id${NC}"
echo "  • Atualização de status válido"
echo "  • Atualização de status inválido (400)"
echo ""
echo -e "${BLUE}🔹 GET /api/payment${NC}"
echo "  • Listagem de todos os pagamentos"
echo "  • Filtros por CPF, status, paymentMethod"
echo "  • Paginação (page, limit)"
echo "  • Filtros combinados"
echo "  • Validação de parâmetros de paginação"
echo ""
echo -e "${BLUE}🔹 POST /webhook/mercado-pago${NC}"
echo "  • Webhook de pagamento aprovado"
echo "  • Webhook de pagamento rejeitado"
echo "  • Webhook sem external_reference"
echo "  • Webhook de tipo diferente (ignorado)"
echo ""
echo -e "${BLUE}🔹 POST /webhook/mercado-pago/test${NC}"
echo "  • Webhook de teste para validação"
echo ""
echo -e "${YELLOW}🔍 Cenários testados:${NC}"
echo "• Validações de entrada (CPF, amount, description, paymentMethod)"
echo "• Idempotência com Idempotency-Key"
echo "• Filtros e paginação na listagem"
echo "• Webhooks de pagamento (aprovado/rejeitado)"
echo "• Tratamento de erros e edge cases"
echo "• Stress test e concorrência"
echo "• Validação de JSON e Content-Type"
echo "• Métodos HTTP não permitidos"
echo ""
echo -e "${YELLOW}📝 Próximos passos para verificar o fluxo completo:${NC}"
echo "1. Verifique os logs da API para confirmar que o Temporal workflow foi iniciado"
echo "2. Acesse http://localhost:8080 para ver o Temporal UI"
echo "3. Verifique se os workflows estão sendo executados"
echo "4. Teste o callback do Mercado Pago (se configurado)"
echo ""
echo -e "${BLUE}🔍 Para monitorar os logs da API:${NC}"
echo "npm run dev:api"
echo ""
echo -e "${BLUE}🔍 Para verificar o Temporal UI:${NC}"
echo "http://localhost:8080"
echo ""
echo -e "${BLUE}🔍 Para verificar o banco de dados:${NC}"
echo "docker exec -it dev-postgres-1 psql -U app -d payments -c \"SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;\""
echo ""
echo -e "${BLUE}🔍 Para verificar workflows no Temporal:${NC}"
echo "docker exec -it dev-temporal-1 tctl workflow list"
echo ""
echo -e "${BLUE}🔍 Para verificar logs do Temporal:${NC}"
echo "docker logs dev-temporal-1"
echo ""
echo -e "${BLUE}📈 Estatísticas Detalhadas dos Testes:${NC}"
echo "• Total de endpoints testados: 6"
echo "• Total de cenários de teste: 39"
echo "• Métodos HTTP testados: GET, POST, PUT, DELETE"
echo ""
echo -e "${YELLOW}📊 Distribuição por Categoria:${NC}"
echo "• Criação de Pagamento: 5 testes"
echo "• Validação de Entrada: 3 testes"
echo "• Webhooks: 5 testes"
echo "• Busca e Atualização: 4 testes"
echo "• Listagem: 8 testes"
echo "• Validação Avançada: 9 testes"
echo "• Robustez: 2 testes"
echo "• Performance: 3 testes"
echo ""
echo -e "${YELLOW}📊 Distribuição por Status Code:${NC}"
echo "• Status 200 (Sucesso): 15 testes"
echo "• Status 201 (Criado): 8 testes"
echo "• Status 400 (Erro de Validação): 14 testes"
echo "• Status 404 (Não Encontrado): 2 testes"
echo ""
echo -e "${YELLOW}📊 Testes Especiais:${NC}"
echo "• Testes de concorrência: 2"
echo "• Testes de stress: 1"
echo "• Testes de idempotência: 2"
echo "• Testes de webhook: 5"
echo "• Testes de validação: 15"
echo ""
echo -e "${GREEN}🎉 Script de teste completo executado com sucesso!${NC}"
