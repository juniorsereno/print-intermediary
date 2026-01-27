# Guia Completo: Desenvolvimento de MCP Server com HTTP Streamable

Este guia documenta como criar um servidor MCP (Model Context Protocol) usando HTTP Streamable Transport, baseado no padrão do projeto MultiClube MCP Server.

## Índice

1. [Conceitos Fundamentais](#conceitos-fundamentais)
2. [Estrutura do Projeto](#estrutura-do-projeto)
3. [Configuração Inicial](#configuração-inicial)
4. [Implementação do Servidor](#implementação-do-servidor)
5. [Criação de Tools](#criação-de-tools)
6. [Integração com n8n](#integração-com-n8n)
7. [Troubleshooting](#troubleshooting)

---

## Conceitos Fundamentais

### O que é MCP?

MCP (Model Context Protocol) é um protocolo que permite que LLMs (Large Language Models) interajam com ferramentas externas de forma padronizada. Um servidor MCP expõe "tools" (ferramentas) que a LLM pode chamar.

### Transporte HTTP Streamable

O **StreamableHTTPServerTransport** é um dos transportes disponíveis no MCP SDK. Diferente do transporte stdio (usado em CLIs), o HTTP permite:

- Acesso via rede (ideal para n8n, APIs, etc.)
- Múltiplas sessões simultâneas
- Integração com webhooks e servidores web

### Arquitetura

```
┌─────────────┐      HTTP      ┌──────────────┐
│   n8n/LLM   │ ◄────────────► │  MCP Server  │
│             │   /mcp         │  (Express)   │
└─────────────┘                └──────────────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │   Tools      │
                               │  (Funções)   │
                               └──────────────┘
```

---

## Estrutura do Projeto

### Estrutura de Pastas

```
meu-mcp-server/
├── src/
│   └── index.ts          # Arquivo principal
├── build/                # Código compilado (gerado)
├── package.json
├── tsconfig.json
└── .env                  # Variáveis de ambiente
```

### Dependências Essenciais

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.1",
    "express": "^4.21.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "typescript": "^5.7.2"
  }
}
```

---

## Configuração Inicial

### 1. package.json

```json
{
  "name": "meu-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "build/index.js",
  "scripts": {
    "build": "tsc && node -e \"require('fs').chmodSync('build/index.js', '755')\"",
    "start": "node build/index.js"
  }
}
```

**IMPORTANTE:** `"type": "module"` é obrigatório para usar ES modules.

### 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**CRÍTICO:** Use `"module": "NodeNext"` e `"moduleResolution": "NodeNext"` para compatibilidade com ES modules.

---

## Implementação do Servidor

### Estrutura Básica (src/index.ts)

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express, { Request, Response } from 'express';
import crypto from 'crypto';

// Configurações
const PORT = process.env.PORT || 3000;

// Cria servidor Express
const app = express();

// Cria servidor MCP
const server = new McpServer({
    name: "meu-servidor",
    version: "1.0.0"
});

// Armazena sessões ativas
const transports = new Map<string, StreamableHTTPServerTransport>();

// Endpoint MCP - ÚNICO endpoint para todas as operações
app.all('/mcp', async (req: Request, res: Response) => {
    console.log(`[MCP] ${req.method} request received`);
    
    // Obtém ou cria session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
        // Reutiliza transporte existente
        transport = transports.get(sessionId)!;
        console.log(`[MCP] Reusing session: ${sessionId}`);
    } else if (req.method === 'POST' || req.method === 'GET') {
        // Cria novo transporte para nova sessão
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (newSessionId) => {
                console.log(`[MCP] New session initialized: ${newSessionId}`);
                transports.set(newSessionId, transport);
            }
        });

        // Conecta o servidor MCP ao transporte
        await server.connect(transport);

        // Limpa sessão quando fechada
        transport.onclose = () => {
            const sid = Array.from(transports.entries()).find(([_, t]) => t === transport)?.[0];
            if (sid) {
                console.log(`[MCP] Session closed: ${sid}`);
                transports.delete(sid);
            }
        };
    } else {
        res.status(400).json({ error: 'Bad Request: No valid session' });
        return;
    }

    // Delega o handling para o transporte
    try {
        await transport.handleRequest(req, res);
    } catch (error: any) {
        console.error(`[MCP] Error handling request:`, error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// Endpoint DELETE para encerrar sessão
app.delete('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    
    if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.close();
        transports.delete(sessionId);
        console.log(`[MCP] Session terminated: ${sessionId}`);
        res.status(200).json({ message: 'Session terminated' });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', transport: 'streamable-http' });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`MCP Server running on port ${PORT}`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
```

### Pontos Críticos da Implementação

#### 1. Gerenciamento de Sessões

```typescript
const transports = new Map<string, StreamableHTTPServerTransport>();
```

- Cada cliente (n8n, LLM) mantém uma sessão
- O `sessionId` é enviado no header `mcp-session-id`
- Sessões são reutilizadas para múltiplas chamadas

#### 2. Endpoint `/mcp`

- **DEVE** aceitar `GET`, `POST` e `DELETE`
- **NÃO** use middleware de body parsing (o transporte faz isso)
- **SEMPRE** delegue para `transport.handleRequest(req, res)`

#### 3. Inicialização do Transporte

```typescript
transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (newSessionId) => {
        transports.set(newSessionId, transport);
    }
});

await server.connect(transport);
```

**ORDEM IMPORTANTE:**
1. Criar transporte
2. Conectar servidor ao transporte
3. Configurar callback de fechamento

---

## Criação de Tools

### Anatomia de uma Tool

```typescript
server.tool(
    "nome_da_tool",           // Nome único
    "Descrição da tool",      // Descrição para a LLM
    {                         // Schema de parâmetros (Zod)
        parametro1: z.string().describe("Descrição do parâmetro"),
        parametro2: z.number().min(1).describe("Número maior que 0")
    },
    async ({ parametro1, parametro2 }) => {  // Handler
        // Lógica da tool
        
        return {
            content: [{
                type: "text",
                text: "Resultado da operação"
            }]
        };
    }
);
```

### Exemplo Completo: Tool de Soma

```typescript
server.tool(
    "somar",
    "Soma dois números e retorna o resultado",
    {
        a: z.number().describe("Primeiro número"),
        b: z.number().describe("Segundo número")
    },
    async ({ a, b }) => {
        const resultado = a + b;
        
        return {
            content: [{
                type: "text",
                text: `A soma de ${a} + ${b} = ${resultado}`
            }]
        };
    }
);
```

### Exemplo: Tool com Validação e Erro

```typescript
server.tool(
    "dividir",
    "Divide dois números",
    {
        dividendo: z.number().describe("Número a ser dividido"),
        divisor: z.number().describe("Número divisor (não pode ser zero)")
    },
    async ({ dividendo, divisor }) => {
        // Validação
        if (divisor === 0) {
            return {
                content: [{
                    type: "text",
                    text: "ERRO: Divisão por zero não é permitida"
                }],
                isError: true
            };
        }
        
        const resultado = dividendo / divisor;
        
        return {
            content: [{
                type: "text",
                text: `${dividendo} ÷ ${divisor} = ${resultado}`
            }]
        };
    }
);
```

### Exemplo: Tool com Chamada Externa (API)

```typescript
import axios from 'axios';

server.tool(
    "consultar_cep",
    "Consulta informações de um CEP brasileiro",
    {
        cep: z.string().regex(/^\d{8}$/).describe("CEP com 8 dígitos numéricos")
    },
    async ({ cep }) => {
        try {
            const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
            
            if (response.data.erro) {
                return {
                    content: [{
                        type: "text",
                        text: `CEP ${cep} não encontrado`
                    }],
                    isError: true
                };
            }
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(response.data, null, 2)
                }]
            };
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Erro ao consultar CEP: ${error.message}`
                }],
                isError: true
            };
        }
    }
);
```

### Boas Práticas para Tools

1. **Descrições Claras**: A LLM usa as descrições para decidir quando chamar a tool
2. **Validação com Zod**: Use `.regex()`, `.min()`, `.max()`, `.email()`, etc.
3. **Tratamento de Erros**: Sempre use try/catch e retorne `isError: true`
4. **Retorno Estruturado**: Use JSON.stringify() para objetos complexos
5. **Logs**: Use `console.log()` ou `console.error()` para debug

---

## Integração com n8n

### Configuração no n8n

1. **Adicione o node "MCP Tool"**
2. **Configure a conexão:**
   - **Transport**: HTTP
   - **URL**: `http://seu-servidor:3000/mcp`
   - **Method**: POST

3. **Selecione a Tool:**
   - O n8n vai listar automaticamente as tools disponíveis
   - Preencha os parâmetros necessários

### Testando a Conexão

Use o endpoint `/health` para verificar se o servidor está rodando:

```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "transport": "streamable-http"
}
```

### Listando Tools Disponíveis

O n8n faz isso automaticamente, mas você pode testar manualmente:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

---

## Troubleshooting

### Problema: Tools não aparecem no n8n

**Causas comuns:**

1. **Servidor não está rodando**
   - Verifique: `curl http://localhost:3000/health`

2. **Porta incorreta**
   - Confirme a porta no n8n e no servidor

3. **Endpoint errado**
   - Deve ser `/mcp`, não `/` ou `/api/mcp`

4. **Firewall/Network**
   - Se o servidor está em outro host, verifique conectividade

5. **Sessão não inicializada**
   - Verifique logs do servidor: `[MCP] New session initialized`

### Problema: Tool retorna erro

**Debug:**

1. Verifique os logs do servidor
2. Teste a tool isoladamente
3. Valide os parâmetros com Zod

```typescript
// Adicione logs detalhados
async ({ parametro }) => {
    console.log('[Tool] Parâmetros recebidos:', { parametro });
    
    try {
        // sua lógica
    } catch (error) {
        console.error('[Tool] Erro:', error);
        throw error;
    }
}
```

### Problema: "Module not found"

**Solução:**

1. Verifique `package.json`: `"type": "module"`
2. Use extensões `.js` nos imports:
   ```typescript
   import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
   ```
3. Recompile: `npm run build`

### Problema: TypeScript errors

**Solução:**

1. Verifique `tsconfig.json`:
   ```json
   {
     "module": "NodeNext",
     "moduleResolution": "NodeNext"
   }
   ```

2. Instale types:
   ```bash
   npm install --save-dev @types/node @types/express
   ```

---

## Checklist de Implementação

- [ ] `package.json` com `"type": "module"`
- [ ] `tsconfig.json` com `NodeNext`
- [ ] Imports com extensão `.js`
- [ ] Servidor Express criado
- [ ] Endpoint `/mcp` com `app.all()`
- [ ] Gerenciamento de sessões com Map
- [ ] `StreamableHTTPServerTransport` configurado
- [ ] `server.connect(transport)` chamado
- [ ] Tools definidas com `server.tool()`
- [ ] Validação com Zod
- [ ] Tratamento de erros
- [ ] Endpoint `/health` para monitoramento
- [ ] Build funcionando: `npm run build`
- [ ] Servidor inicia: `npm start`
- [ ] Health check responde: `curl /health`
- [ ] Tools aparecem no n8n

---

## Exemplo Mínimo Funcional

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from 'express';
import crypto from 'crypto';

const app = express();
const server = new McpServer({ name: "minimal-server", version: "1.0.0" });
const transports = new Map();

// Tool de exemplo
server.tool(
    "hello",
    "Retorna uma saudação",
    { nome: z.string().describe("Nome da pessoa") },
    async ({ nome }) => ({
        content: [{ type: "text", text: `Olá, ${nome}!` }]
    })
);

// Endpoint MCP
app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport = transports.get(sessionId);
    
    if (!transport && (req.method === 'POST' || req.method === 'GET')) {
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (id) => transports.set(id, transport)
        });
        await server.connect(transport);
    }
    
    if (transport) {
        await transport.handleRequest(req, res);
    } else {
        res.status(400).json({ error: 'No session' });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## Recursos Adicionais

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Zod Documentation](https://zod.dev/)
- [Express Documentation](https://expressjs.com/)

---

**Última atualização:** Janeiro 2026
