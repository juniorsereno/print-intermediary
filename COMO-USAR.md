# Como Usar o Sistema de Impressão Térmica

## ✅ Sim, você já pode fazer o deploy!

O servidor está pronto para ser implantado no Easypanel e testado com a impressora.

## 🚀 Passos para Deploy no Easypanel

### 1. Fazer Deploy
1. Acesse seu Easypanel
2. Crie um novo App do tipo "Docker Compose"
3. Conecte ao repositório Git
4. Clique em "Deploy"
5. Aguarde o build (pode levar alguns minutos)

### 2. Obter a URL
Após o deploy, o Easypanel fornecerá uma URL pública, algo como:
```
https://print-server.easypanel.host
```

## 🖥️ Testando no Computador da Impressora

### Passo 1: Abrir o Cliente
No computador que está conectado à impressora térmica:

1. Abra o navegador (Chrome, Firefox, Edge)
2. Acesse a URL do seu servidor: `https://print-server.easypanel.host`
3. Você verá uma tela com "Monitor de Impressão"
4. O status deve mudar de "Desconectado" para "Conectado" (verde)
5. **Mantenha esta aba aberta!** Não feche o navegador.

### Passo 2: Enviar um Pedido de Teste

De qualquer outro computador ou do próprio servidor, envie um pedido de teste:

**Opção 1: Usando curl (terminal)**
```bash
curl -X POST https://print-server.easypanel.host/api/print \
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
      }
    ],
    "total": 70.00
  }'
```

**Opção 2: Usando Postman ou Insomnia**
- Método: POST
- URL: `https://print-server.easypanel.host/api/print`
- Headers: `Content-Type: application/json`
- Body (JSON):
```json
{
  "id": 123,
  "customer": "João Silva",
  "address": "Rua das Flores, 456",
  "items": [
    {
      "quantity": 2,
      "name": "Pizza Margherita",
      "price": 35.00
    }
  ],
  "total": 70.00
}
```

### Passo 3: Verificar o Download

No computador da impressora:
1. O arquivo `.saiposprt` deve ser baixado automaticamente
2. Verifique a pasta **Downloads**
3. O arquivo terá um nome como `pedido.saiposprt`
4. Abra este arquivo com o software da impressora Saipos

## 📊 Verificando o Status

Para ver quantos clientes estão conectados:
```
https://print-server.easypanel.host/api/status
```

Resposta esperada:
```json
{
  "connectedClients": 1,
  "clients": [
    {
      "id": "abc-123-def",
      "connectedAt": "2026-01-20T21:00:00.000Z"
    }
  ],
  "historyCount": 0
}
```

## 🔧 Troubleshooting

### Problema: Cliente não conecta
**Sintomas:** Status permanece "Desconectado" (vermelho)

**Soluções:**
1. Verifique se a URL está correta
2. Verifique se o servidor está rodando (acesse `/health`)
3. Abra o Console do navegador (F12) e veja se há erros
4. Tente recarregar a página (F5)

### Problema: Arquivo não baixa
**Sintomas:** Pedido é enviado mas arquivo não aparece na pasta Downloads

**Soluções:**
1. Verifique se o navegador permite downloads automáticos
2. Verifique as configurações de bloqueio de pop-ups
3. Tente em outro navegador (Chrome geralmente funciona melhor)
4. Verifique se a pasta Downloads tem permissão de escrita

### Problema: Erro "No printers connected"
**Sintomas:** API retorna `{"success": false, "message": "No printers connected"}`

**Soluções:**
1. Certifique-se de que o cliente WebSocket está aberto no navegador
2. Verifique se o status mostra "Conectado" (verde)
3. Verifique `/api/status` para confirmar que há clientes conectados

### Problema: Dados inválidos
**Sintomas:** API retorna erro 400 com mensagem de validação

**Soluções:**
1. Verifique se todos os campos obrigatórios estão presentes:
   - `id` (número positivo)
   - `customer` (texto não vazio)
   - `items` (array com pelo menos 1 item)
   - `total` (número não negativo)
2. Verifique se cada item tem:
   - `quantity` (número positivo)
   - `name` (texto não vazio)
   - `price` (número não negativo)

## 🔗 Integrando com Seu Sistema

Quando você quiser integrar com seu sistema de pedidos existente, basta fazer um POST para a API:

```javascript
// Exemplo em JavaScript
async function enviarParaImpressao(pedido) {
  try {
    const response = await fetch('https://print-server.easypanel.host/api/print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: pedido.id,
        customer: pedido.cliente,
        address: pedido.endereco,
        items: pedido.itens.map(item => ({
          quantity: item.quantidade,
          name: item.nome,
          price: item.preco
        })),
        total: pedido.total
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Pedido enviado para impressão:', result.jobId);
      return true;
    } else {
      console.error('❌ Erro:', result.error || result.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro de conexão:', error);
    return false;
  }
}
```

## 📱 Endpoints Disponíveis

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/` | GET | Página do cliente WebSocket |
| `/health` | GET | Health check do servidor |
| `/api/status` | GET | Status de clientes conectados |
| `/api/history?limit=50` | GET | Histórico de impressões |
| `/api/print` | POST | Enviar pedido para impressão |

## 🎯 Próximos Passos

Depois de testar e confirmar que está funcionando:

1. **Integração com Sistema de Pedidos**
   - Adicione a chamada à API no seu sistema
   - Teste com pedidos reais

2. **Múltiplas Impressoras**
   - Abra o cliente em vários computadores
   - Todos receberão os pedidos simultaneamente

3. **Monitoramento**
   - Use `/api/history` para ver histórico
   - Use `/api/status` para monitorar conexões

4. **Segurança (Opcional)**
   - Adicione autenticação se necessário
   - Configure CORS para seus domínios

## 💡 Dicas

- **Mantenha o cliente sempre aberto** no computador da impressora
- **Use Chrome ou Edge** para melhor compatibilidade
- **Teste primeiro** com pedidos simples antes de integrar
- **Monitore os logs** no Easypanel se houver problemas
- **Verifique o histórico** em `/api/history` para debug

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no Easypanel
2. Teste os endpoints individualmente
3. Verifique o console do navegador (F12)
4. Confirme que o servidor está rodando (`/health`)
