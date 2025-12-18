# Projeto: Módulo de Impressão Térmica Remota

## Visão Geral

Este módulo resolve um problema específico de infraestrutura distribuída: imprimir comandas fiscais ou de produção em uma impressora térmica USB conectada a um computador local, a partir de um comando gerado em um servidor na nuvem (VPS).

O desafio principal é a impossibilidade do navegador ou da VPS acessarem diretamente o hardware USB local. A solução adotada utiliza o navegador do computador local como "proxy", aproveitando um software monitor de pasta (Printer) já existente no cliente.

## Arquitetura da Solução

### 1. Fluxo de Dados

```mermaid
graph LR
    A[Soli Pizzaria (VPS)] -->|HTTP POST| B[Print Intermediary (VPS)]
    B -->|WebSocket| C[Dashboard Web (PC Local)]
    C -->|Auto Download| D[Pasta Downloads (PC Local)]
    D -->|File Watcher| E[Printer Driver]
    E -->|USB| F[Impressora Térmica]
```

### 2. Componentes

*   **API Server (Node.js):** Responsável por receber a requisição de impressão, traduzir os dados do pedido (JSON simples) para o protocolo complexo da impressora (tags proprietárias + Base64), e notificar os clientes conectados.
*   **Web Client (HTML/JS):** Um dashboard minimalista que mantém uma conexão persistente (WebSocket) com o servidor. Sua única função é receber o payload do arquivo e forçar o download imediato.

### 3. Protocolo de Arquivo (.saiposprt)

O sistema emula o formato esperado pelo software de impressão Saipos/Similar:
*   **Estrutura:** JSON contendo configurações de impressão e array de linhas.
*   **Formatação:** Tags como `<ae>` (alinhar esquerda), `<ad>` (alinhar direita), `<n>` (negrito), `<linha_simples>` (separador).
*   **Entrega:** O arquivo não é salvo como texto plano, mas sim gerado como um Data URI Base64 (`data:text/json;charset=utf-8,BASE64...`) para garantir a integridade dos caracteres e formatação ao ser baixado pelo navegador.

## Estrutura de Pastas

```
print-intermediary/
├── public/
│   └── index.html      # Frontend do Dashboard
├── src/
│   └── server.js       # API Server e Lógica de Formatação
├── Dockerfile          # Definição da Imagem Docker
├── docker-compose.yml  # Orquestração para Produção
├── simulate_order.js   # Script de Teste/Simulação
└── README.md           # Documentação de Uso
```

## Decisões Técnicas

*   **Node.js:** Escolhido pela facilidade em lidar com I/O assíncrono (WebSockets) e manipulação de strings/buffers para gerar o arquivo binário.
*   **Socket.io:** Garante comunicação em tempo real robusta entre a VPS e o navegador local, lidando automaticamente com reconexões.
*   **Data URI Download:** Estratégia utilizada para gerar o arquivo inteiramente no cliente (frontend) ou repassar o blob gerado pelo servidor, sem a necessidade de armazenamento em disco na VPS.

## Manutenção

Para alterar o layout do cupom (ex: adicionar logo, mudar rodapé), edite a função `generateSaiposContent` no arquivo `src/server.js`. As tags de formatação seguem o padrão observado nos arquivos de exemplo (engenharia reversa do formato `.saiposprt`).