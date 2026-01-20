#!/bin/bash

# Script de teste para a API de impressão
# Uso: ./test-api.sh [URL_DO_SERVIDOR]
# Exemplo: ./test-api.sh https://print-server.easypanel.host

SERVER_URL="${1:-http://localhost:3000}"

echo "🧪 Testando API de Impressão Térmica"
echo "📡 Servidor: $SERVER_URL"
echo ""

# Teste 1: Health Check
echo "1️⃣  Testando Health Check..."
curl -s "$SERVER_URL/health" | jq '.'
echo ""

# Teste 2: Status
echo "2️⃣  Verificando Status..."
curl -s "$SERVER_URL/api/status" | jq '.'
echo ""

# Teste 3: Enviar Pedido
echo "3️⃣  Enviando Pedido de Teste..."
curl -s -X POST "$SERVER_URL/api/print" \
  -H "Content-Type: application/json" \
  -d @test-pedido.json | jq '.'
echo ""

# Teste 4: Histórico
echo "4️⃣  Verificando Histórico..."
curl -s "$SERVER_URL/api/history?limit=5" | jq '.'
echo ""

echo "✅ Testes concluídos!"
echo ""
echo "💡 Dicas:"
echo "   - Se 'connectedClients' for 0, abra o cliente no navegador"
echo "   - Se o pedido falhar, verifique se há clientes conectados"
echo "   - Acesse $SERVER_URL/ para abrir o cliente WebSocket"
