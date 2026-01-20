# Deploy do MCP Thermal Print Server

## Deploy no Easypanel

### Pré-requisitos
- Conta no Easypanel
- Repositório Git com o código

### Passos para Deploy

1. **No Easypanel, crie um novo App**
   - Tipo: Docker Compose
   - Conecte ao seu repositório Git

2. **Configuração do Docker Compose**
   - O Easypanel vai usar o arquivo `docker-compose.yml` automaticamente
   - A porta 3000 será exposta

3. **Variáveis de Ambiente (opcional)**
   - `PORT`: Porta do servidor (padrão: 3000)
   - `ID_STORE`: ID da loja no Saipos (padrão: 72144)
   - `ID_USER`: ID do usuário (padrão: 1)

4. **Deploy**
   - Clique em "Deploy"
   - Aguarde o build e inicialização

5. **Obter a URL**
   - Após o deploy, o Easypanel fornecerá uma URL pública
   - Exemplo: `https://seu-app.easypanel.host`

### Testando o Sistema

#### 1. Abrir o Cliente WebSocket
No computador conectado à impressora:
1. Acesse: `https://seu-app.easypanel.host/`
2. Você verá a página "Monitor de Impressão"
3. O status deve mudar para "Conectado"
4. Mantenha esta página aberta

#### 2. Enviar um Pedido de Teste
Use curl, Postman, ou qualquer cliente HTTP:

```bash
curl -X POST https://seu-app.easypanel.host/api/print \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123,
    "customer": "João Silva",
    "address": "Rua das Flores, 456",
    "items": [
      {
        "quantity": 2,
        "name": "Pizza Margherita",
        "price": 35.00
      },
      {
        "quantity": 1,
        "name": "Refrigerante 2L",
        "price": 8.00
      }
    ],
    "total": 78.00
  }'
```

#### 3. Verificar o Download
- O arquivo `.saiposprt` deve ser baixado automaticamente
- Verifique a pasta Downloads do computador
- O arquivo pode ser aberto pelo software da impressora

### Endpoints Disponíveis

- `GET /` - Página do cliente WebSocket
- `GET /health` - Health check do servidor
- `GET /api/status` - Status de clientes conectados
- `GET /api/history?limit=50` - Histórico de impressões
- `POST /api/print` - Enviar pedido para impressão
- `WebSocket ws://` - Conexão WebSocket para clientes

### Monitoramento

#### Verificar Status
```bash
curl https://seu-app.easypanel.host/api/status
```

Resposta:
```json
{
  "connectedClients": 1,
  "clients": [
    {
      "id": "uuid-do-cliente",
      "connectedAt": "2026-01-20T21:00:00.000Z"
    }
  ],
  "historyCount": 5
}
```

#### Verificar Histórico
```bash
curl https://seu-app.easypanel.host/api/history?limit=10
```

### Troubleshooting

#### Cliente não conecta
- Verifique se a URL está correta
- Verifique se o servidor está rodando (acesse `/health`)
- Verifique o console do navegador para erros

#### Arquivo não baixa
- Verifique se o navegador permite downloads automáticos
- Verifique as configurações de bloqueio de pop-ups
- Tente em outro navegador

#### Erro "No printers connected"
- Certifique-se de que o cliente WebSocket está aberto e conectado
- Verifique o status em `/api/status`

### Logs

Para ver os logs no Easypanel:
1. Acesse o painel do seu app
2. Vá em "Logs"
3. Os logs são estruturados em JSON com níveis INFO, WARN, ERROR

Exemplo de log:
```json
{
  "timestamp": "2026-01-20T21:00:00.000Z",
  "level": "INFO",
  "component": "WebSocketManager",
  "message": "Client connected",
  "data": {
    "clientId": "uuid",
    "totalClients": 1
  }
}
```

## Deploy Local (para testes)

### Usando Docker Compose
```bash
# Build e start
docker-compose up --build

# Acessar
# Cliente: http://localhost:3000
# API: http://localhost:3000/api/status
```

### Usando Node.js diretamente
```bash
# Instalar dependências
npm install

# Build
npm run build

# Start
npm start

# Ou em modo desenvolvimento
npm run dev
```

## Integração com Sistema Existente

Para integrar com seu sistema de pedidos:

1. **Quando um novo pedido chegar**, faça um POST para `/api/print`:
```javascript
const response = await fetch('https://seu-app.easypanel.host/api/print', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(orderData)
});

const result = await response.json();
if (result.success) {
  console.log('Pedido enviado para impressão:', result.jobId);
} else {
  console.error('Erro ao enviar pedido:', result.error);
}
```

2. **Verificar se há impressoras conectadas** antes de enviar:
```javascript
const status = await fetch('https://seu-app.easypanel.host/api/status')
  .then(r => r.json());

if (status.connectedClients === 0) {
  alert('Nenhuma impressora conectada!');
}
```

## Segurança

Para produção, considere adicionar:
- Autenticação (API key, JWT)
- HTTPS (o Easypanel já fornece)
- Rate limiting
- CORS configurado para seus domínios

Exemplo de variáveis de ambiente adicionais:
```yaml
environment:
  - PORT=3000
  - ID_STORE=72144
  - ID_USER=1
  - API_KEY=sua-chave-secreta
  - ALLOWED_ORIGINS=https://seu-site.com
```
