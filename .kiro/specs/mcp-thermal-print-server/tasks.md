# Implementation Plan: MCP Thermal Print Server

## Overview

Este plano de implementação transforma o sistema de impressão térmica existente em um servidor MCP compatível. A implementação será feita em TypeScript/Node.js, mantendo compatibilidade total com o sistema atual enquanto adiciona ferramentas MCP para LLMs. O desenvolvimento seguirá uma abordagem incremental, validando funcionalidades core através de testes em cada etapa.

## Tasks

- [x] 1. Setup do projeto e dependências
  - Inicializar projeto Node.js com TypeScript
  - Instalar dependências: `@modelcontextprotocol/sdk`, `express`, `socket.io`, `zod`, `fast-check`, `uuid`
  - Configurar TypeScript (tsconfig.json) com strict mode
  - Configurar estrutura de pastas: src/, src/components/, src/types/, tests/
  - Configurar Jest ou Vitest para testes
  - _Requirements: 1.1, 1.2_

- [x] 2. Implementar modelos de dados e schemas Zod
  - [x] 2.1 Criar tipos TypeScript para OrderData, OrderItem, PrintJob, ClientInfo
    - Definir interfaces em src/types/models.ts
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 2.2 Criar schemas Zod para validação
    - Implementar OrderDataSchema, OrderItemSchema
    - Implementar validação de campos obrigatórios e tipos
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 2.3 Escrever property test para validação de dados
    - **Property 4: Order Data Field Validation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
    - Gerar OrderData inválidos aleatórios e verificar rejeição
    - Verificar mensagens de erro descritivas

- [x] 3. Implementar componente Data Validator
  - [x] 3.1 Criar classe DataValidator em src/components/validator.ts
    - Implementar método validateOrderData usando Zod
    - Implementar método validateHistoryLimit
    - Retornar ValidationResult com success/error
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [x] 3.2 Escrever unit tests para casos extremos de validação
    - Testar campos faltando, tipos incorretos, valores limite
    - _Requirements: 3.6_

- [x] 4. Implementar componente Saiposprt Formatter
  - [x] 4.1 Criar classe SaiposFormatter em src/components/formatter.ts
    - Implementar método format(orderData): string
    - Implementar generatePrintSettings privado
    - Implementar generatePrintRows privado
    - Implementar encodeToDataUrl privado (JSON → base64 → data URL)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [x] 4.2 Escrever property test para formatação válida
    - **Property 5: Valid Order Data Formatting**
    - **Validates: Requirements 2.3, 8.3**
    - Gerar OrderData válidos aleatórios e verificar formato Saiposprt
  
  - [x] 4.3 Escrever property test para round-trip Saiposprt
    - **Property 6: Saiposprt Format Round Trip**
    - **Validates: Requirements 8.1, 8.2, 8.4, 8.5**
    - Formatar → decodificar → verificar dados originais preservados
  
  - [x] 4.4 Escrever property test para geração de filename
    - **Property 7: Saiposprt Filename Generation**
    - **Validates: Requirements 8.6**
    - Verificar padrão "orderId.saiposprt"
  
  - [x] 4.5 Escrever property test para estrutura Saiposprt
    - **Property 16: Saiposprt Format Structure Consistency**
    - **Validates: Requirements 6.4**
    - Verificar campos obrigatórios: printSettings, printRows, sale_number, id_sale, logData

- [x] 5. Checkpoint - Validação e formatação funcionando
  - Executar todos os testes até aqui
  - Verificar que validação rejeita dados inválidos corretamente
  - Verificar que formatação produz Saiposprt válido
  - Perguntar ao usuário se há dúvidas

- [x] 6. Implementar componente WebSocket Manager
  - [x] 6.1 Criar classe WebSocketManager em src/components/websocket.ts
    - Inicializar Socket.io server
    - Implementar registro de conexões com IDs únicos
    - Implementar método broadcast(data)
    - Implementar getConnectedClients() e getClientCount()
    - Implementar handlers para connection/disconnect
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [x] 6.2 Escrever property test para broadcast
    - **Property 8: WebSocket Broadcast to All Clients**
    - **Validates: Requirements 2.4, 9.4**
    - Simular N clientes conectados e verificar todos recebem dados
  
  - [x] 6.3 Escrever property test para IDs únicos
    - **Property 17: WebSocket Connection Unique IDs**
    - **Validates: Requirements 9.2**
    - Conectar N clientes e verificar IDs únicos
  
  - [x] 6.4 Escrever property test para cleanup de desconexão
    - **Property 18: WebSocket Disconnection Cleanup**
    - **Validates: Requirements 9.3**
    - Desconectar cliente e verificar contagem diminui
  
  - [x] 6.5 Escrever unit tests para casos extremos WebSocket
    - Testar zero clientes, erro em um cliente não afeta outros
    - _Requirements: 9.5_

- [x] 7. Implementar componente Print History
  - [x] 7.1 Criar classe PrintHistory em src/components/history.ts
    - Implementar circular buffer com maxSize=1000
    - Implementar método add(job)
    - Implementar método getRecent(limit)
    - Implementar getCount() e clear()
    - _Requirements: 5.2, 5.3, 5.4, 5.5_
  
  - [x] 7.2 Escrever property test para limite de histórico
    - **Property 12: Print History Limit Enforcement**
    - **Validates: Requirements 5.3**
    - Solicitar L jobs e verificar retorno <= L
  
  - [x] 7.3 Escrever property test para completude de entradas
    - **Property 13: Print History Entry Completeness**
    - **Validates: Requirements 5.4**
    - Verificar todos os campos obrigatórios presentes
  
  - [x] 7.4 Escrever property test para circular buffer
    - **Property 14: Print History Circular Buffer Size**
    - **Validates: Requirements 5.5**
    - Adicionar >1000 jobs e verificar tamanho máximo 1000

- [x] 8. Checkpoint - Componentes core funcionando
  - Executar todos os testes
  - Verificar WebSocket aceita conexões e faz broadcast
  - Verificar histórico mantém limite de 1000 entradas
  - Perguntar ao usuário se há dúvidas

- [x] 9. Implementar servidor MCP
  - [x] 9.1 Criar classe MCPThermalPrintServer em src/server.ts
    - Inicializar McpServer do SDK
    - Configurar StreamableHTTPServerTransport
    - Implementar método initialize() para registrar ferramentas
    - Implementar método start() para iniciar servidor HTTP
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 9.2 Registrar ferramenta send_print_job
    - Definir schema de input usando Zod
    - Implementar handler: validar → formatar → broadcast → adicionar ao histórico
    - Retornar success com jobId ou erro
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 9.3 Registrar ferramenta check_printer_status
    - Implementar handler: retornar contagem e detalhes de clientes
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 9.4 Registrar ferramenta get_print_history
    - Definir schema de input com limite opcional
    - Implementar handler: retornar histórico com limite
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [x] 9.5 Escrever property test para descoberta de ferramentas
    - **Property 1: MCP Tool Discovery Response Validity**
    - **Validates: Requirements 1.2**
    - Conectar e verificar 3 ferramentas com schemas válidos
  
  - [x] 9.6 Escrever property test para formato de requisição MCP
    - **Property 2: MCP Request Format Acceptance**
    - **Validates: Requirements 1.3**
    - Gerar requisições JSON-RPC 2.0 válidas e verificar aceitação
  
  - [x] 9.7 Escrever property test para formato de resposta MCP
    - **Property 3: MCP Response Format Compliance**
    - **Validates: Requirements 1.4**
    - Invocar ferramentas e verificar conformidade JSON-RPC 2.0
  
  - [x] 9.8 Escrever property test para resposta de print job bem-sucedido
    - **Property 9: Successful Print Job Response**
    - **Validates: Requirements 2.6, 7.1**
    - Enviar jobs válidos e verificar success=true e jobId não-vazio
  
  - [x] 9.9 Escrever property test para contagem de clientes
    - **Property 10: Printer Status Client Count Accuracy**
    - **Validates: Requirements 4.2**
    - Conectar N clientes e verificar check_printer_status retorna N
  
  - [x] 9.10 Escrever property test para detalhes de clientes
    - **Property 11: Printer Status Client Details Completeness**
    - **Validates: Requirements 4.3**
    - Verificar id e connectedAt presentes para cada cliente
  
  - [x] 9.11 Escrever unit tests para casos extremos MCP
    - Testar zero clientes conectados, histórico vazio
    - _Requirements: 2.5, 4.4_

- [x] 10. Implementar endpoint HTTP legacy
  - [x] 10.1 Criar classe LegacyHttpHandler em src/components/legacy.ts
    - Implementar handlePrintRequest(req, res)
    - Reutilizar validator, formatter, wsManager, history
    - Manter compatibilidade com formato de resposta atual
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [x] 10.2 Escrever property test para compatibilidade legacy
    - **Property 15: Legacy HTTP Endpoint Compatibility**
    - **Validates: Requirements 6.2**
    - Enviar OrderData via POST /api/print e via MCP, comparar resultados
  
  - [x] 10.3 Escrever unit tests para endpoint legacy
    - Testar POST /api/print com dados válidos e inválidos
    - _Requirements: 6.1_

- [x] 11. Checkpoint - Servidor completo funcionando
  - Executar todos os testes
  - Testar servidor MCP manualmente com cliente MCP
  - Testar endpoint legacy com curl/Postman
  - Verificar WebSocket entrega dados aos clientes
  - Perguntar ao usuário se há dúvidas

- [x] 12. Implementar tratamento de erros
  - [x] 12.1 Adicionar error handling em todos os componentes
    - Implementar try-catch em handlers de ferramentas MCP
    - Implementar error responses no formato JSON-RPC 2.0
    - Adicionar logging apropriado (INFO, WARN, ERROR)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 12.2 Escrever property test para segurança de erros
    - **Property 20: Error Response Safety**
    - **Validates: Requirements 7.5**
    - Forçar erros e verificar respostas não expõem detalhes internos
  
  - [x] 12.3 Escrever unit tests para condições de erro
    - Testar erros de validação, WebSocket, MCP protocol
    - _Requirements: 7.2, 7.3, 7.4_

- [ ] 13. Adicionar documentação de ferramentas
  - [ ] 13.1 Documentar cada ferramenta MCP
    - Adicionar descriptions detalhadas
    - Adicionar exemplos de input válido
    - Documentar formato de output
    - Documentar condições de erro possíveis
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ] 13.2 Escrever property test para completude de documentação
    - **Property 19: Tool Documentation Completeness**
    - **Validates: Requirements 10.1, 10.2, 10.4**
    - Verificar description, inputSchema, output format presentes

- [ ] 14. Criar arquivo de configuração e ponto de entrada
  - [ ] 14.1 Criar src/config.ts com configurações
    - Porta do servidor, idStore, idUser, maxHistorySize
    - Carregar de variáveis de ambiente
    - _Requirements: 1.1_
  
  - [ ] 14.2 Criar src/index.ts como ponto de entrada
    - Instanciar todos os componentes
    - Inicializar e iniciar servidor
    - Adicionar graceful shutdown
    - _Requirements: 1.1, 1.5_

- [ ] 15. Testes de integração end-to-end
  - [ ] 15.1 Escrever teste de integração: LLM → MCP → WebSocket → Cliente
    - Simular fluxo completo de envio de pedido
    - Verificar cliente WebSocket recebe dados formatados
    - Verificar histórico registra o job
  
  - [ ] 15.2 Escrever teste de integração: múltiplos clientes simultâneos
    - Conectar múltiplos clientes WebSocket
    - Enviar print job via MCP
    - Verificar todos os clientes recebem
  
  - [ ] 15.3 Escrever teste de integração: compatibilidade legacy + MCP
    - Enviar jobs via POST /api/print e via MCP alternadamente
    - Verificar ambos funcionam corretamente

- [ ] 16. Checkpoint final - Sistema completo
  - Executar toda a suite de testes (unit + property + integration)
  - Verificar cobertura de código >= 80%
  - Testar manualmente com cliente MCP real (Claude Desktop)
  - Testar manualmente com cliente WebSocket real (navegador)
  - Perguntar ao usuário se há dúvidas ou ajustes necessários

- [ ] 17. Documentação e README
  - Criar README.md com instruções de instalação e uso
  - Documentar como configurar o servidor MCP
  - Documentar como conectar clientes WebSocket
  - Adicionar exemplos de uso das ferramentas MCP
  - Documentar variáveis de ambiente

## Notes

- Todas as tasks são obrigatórias para garantir uma implementação abrangente e bem testada
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de correção
- Unit tests validam exemplos específicos e casos extremos
- Testes de integração verificam fluxos end-to-end
