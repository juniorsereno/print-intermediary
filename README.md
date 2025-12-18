# Sistema Intermediário de Impressão - Soli Pizzaria

Este sistema atua como uma ponte entre a API hospedada na VPS e a impressora térmica local. Ele resolve o problema de comunicação direta com o hardware de impressão utilizando o navegador como agente de entrega.

## 🚀 Como Funciona

1.  **Recebimento:** A API recebe um pedido (`POST /api/print`) com os detalhes (cliente, itens, total).
2.  **Processamento:** O backend formata esses dados para o padrão `.saiposprt` (JSON específico com tags de formatação), codifica em Base64 e gera uma Data URI.
3.  **Transmissão:** O backend envia esse arquivo formatado via WebSocket para o **Painel Web**.
4.  **Impressão:** O Painel Web (aberto no computador da pizzaria) recebe o evento e força o **download automático** do arquivo para a pasta `Downloads`. O software de impressão instalado monitora essa pasta e imprime o arquivo.

## 🛠️ Tecnologias

*   **Backend:** Node.js, Express, Socket.io
*   **Frontend:** HTML5, CSS3, JavaScript (WebSocket Client)
*   **Infraestrutura:** Docker, Docker Compose

## 📦 Como Usar (Produção / Easypanel)

Este projeto contém um `Dockerfile` e `docker-compose.yml` prontos para deploy.

1.  Suba este projeto na sua VPS ou gerenciador de containers (Easypanel).
2.  Exponha a porta `3000`.
3.  **No Computador da Pizzaria:**
    *   Acesse o endereço da aplicação no navegador (ex: `https://print.suapizzaria.com`).
    *   Mantenha a página aberta. O status deve mostrar **"Conectado"**.

## 🔌 API Endpoints

### Enviar Pedido para Impressão

*   **URL:** `/api/print`
*   **Método:** `POST`
*   **Headers:** `Content-Type: application/json`
*   **Corpo da Requisição:**

```json
{
  "id": 12345,
  "customer": "João Silva",
  "address": "Rua das Flores, 123 - Centro",
  "items": [
    {
      "quantity": 1,
      "name": "Pizza Calabresa",
      "price": 45.00
    },
    {
      "quantity": 2,
      "name": "Coca-Cola 2L",
      "price": 12.00
    }
  ],
  "total": 69.00
}
```

## 💻 Desenvolvimento Local

1.  Instale as dependências:
    ```bash
    npm install
    ```
2.  Inicie o servidor:
    ```bash
    npm start
    ```
3.  Acesse `http://localhost:3000`.
4.  Simule um pedido:
    ```bash
    node simulate_order.js