# Requirements Document

## Introduction

Este documento especifica os requisitos para transformar um sistema de impressão térmica remota existente em um servidor MCP (Model Context Protocol). O sistema atual utiliza Node.js com Express e Socket.io para receber pedidos via HTTP e enviá-los para impressoras térmicas através de WebSocket. O novo servidor MCP manterá toda a funcionalidade existente enquanto expõe ferramentas estruturadas que permitem que LLMs (Large Language Models) interajam com o sistema de impressão de forma programática.

## Glossary

- **MCP_Server**: O servidor que implementa o Model Context Protocol e expõe ferramentas para LLMs
- **Print_Client**: Navegador local conectado via WebSocket que recebe arquivos .saiposprt e os salva na pasta Downloads
- **Thermal_Printer**: Impressora térmica física que imprime os pedidos
- **Print_Job**: Uma solicitação de impressão contendo dados de pedido formatados
- **Saiposprt_Format**: Formato proprietário do Saipos para arquivos de impressão térmica (JSON codificado em base64)
- **LLM**: Large Language Model que interage com o servidor MCP através de ferramentas
- **WebSocket_Connection**: Conexão bidirecional entre o servidor e os clientes de impressão
- **Order_Data**: Estrutura de dados contendo informações do pedido (cliente, endereço, itens, total)

## Requirements

### Requirement 1: MCP Server Implementation

**User Story:** Como desenvolvedor, eu quero implementar um servidor MCP compatível com o protocolo padrão, para que LLMs possam descobrir e utilizar as ferramentas de impressão disponíveis.

#### Acceptance Criteria

1. THE MCP_Server SHALL implement the Model Context Protocol specification for tool discovery
2. WHEN an LLM connects to the server, THE MCP_Server SHALL expose a list of available tools with their schemas
3. THE MCP_Server SHALL accept tool invocation requests in the MCP standard format
4. WHEN a tool is invoked, THE MCP_Server SHALL return responses in the MCP standard format
5. THE MCP_Server SHALL handle connection lifecycle events (connect, disconnect, error)

### Requirement 2: Print Job Submission Tool

**User Story:** Como LLM, eu quero enviar pedidos de impressão de forma estruturada, para que os dados sejam validados e impressos corretamente na impressora térmica.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a tool named "send_print_job" for submitting print jobs
2. WHEN the tool receives Order_Data, THE MCP_Server SHALL validate all required fields (id, customer, items, total)
3. WHEN Order_Data is valid, THE MCP_Server SHALL format it into Saiposprt_Format
4. WHEN formatting is complete, THE MCP_Server SHALL send the formatted data to connected Print_Clients via WebSocket
5. WHEN a Print_Client is not connected, THE MCP_Server SHALL return an error indicating no clients available
6. WHEN the print job is sent successfully, THE MCP_Server SHALL return a success response with the job ID

### Requirement 3: Data Validation

**User Story:** Como desenvolvedor, eu quero validar rigorosamente os dados de entrada, para que apenas pedidos válidos sejam enviados para impressão.

#### Acceptance Criteria

1. WHEN Order_Data is received, THE MCP_Server SHALL verify that the "id" field is a positive integer
2. WHEN Order_Data is received, THE MCP_Server SHALL verify that the "customer" field is a non-empty string
3. WHEN Order_Data is received, THE MCP_Server SHALL verify that the "items" field is a non-empty array
4. WHEN validating items, THE MCP_Server SHALL verify each item has "quantity" (positive number), "name" (non-empty string), and "price" (non-negative number)
5. WHEN Order_Data is received, THE MCP_Server SHALL verify that the "total" field is a non-negative number
6. WHEN any validation fails, THE MCP_Server SHALL return a descriptive error message indicating which field failed validation

### Requirement 4: Client Connection Status Tool

**User Story:** Como LLM, eu quero verificar o status de conexão dos clientes de impressão, para que eu possa saber se há impressoras disponíveis antes de enviar um pedido.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a tool named "check_printer_status" for querying connection status
2. WHEN the tool is invoked, THE MCP_Server SHALL return the count of connected Print_Clients
3. WHEN the tool is invoked, THE MCP_Server SHALL return connection details for each Print_Client (connection ID, connection time)
4. WHEN no Print_Clients are connected, THE MCP_Server SHALL return a status indicating zero connections

### Requirement 5: Print History Tool

**User Story:** Como LLM, eu quero consultar o histórico de impressões recentes, para que eu possa verificar quais pedidos foram enviados e seu status.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a tool named "get_print_history" for querying print history
2. WHEN the tool is invoked, THE MCP_Server SHALL return the last 50 print jobs by default
3. WHERE a limit parameter is provided, THE MCP_Server SHALL return up to that number of recent print jobs
4. WHEN returning print history, THE MCP_Server SHALL include job ID, timestamp, customer name, total value, and status
5. THE MCP_Server SHALL store print job records in memory with a maximum of 1000 entries

### Requirement 6: Backward Compatibility

**User Story:** Como administrador do sistema, eu quero manter compatibilidade com o sistema atual, para que clientes existentes continuem funcionando sem modificações.

#### Acceptance Criteria

1. THE MCP_Server SHALL maintain the existing HTTP POST endpoint at /api/print
2. WHEN a POST request is received at /api/print, THE MCP_Server SHALL process it using the same logic as before
3. THE MCP_Server SHALL maintain the existing WebSocket connection mechanism for Print_Clients
4. THE MCP_Server SHALL continue generating Saiposprt_Format files with the same structure
5. WHEN Print_Clients connect via WebSocket, THE MCP_Server SHALL handle them identically to the current implementation

### Requirement 7: Error Handling and Feedback

**User Story:** Como LLM, eu quero receber feedback claro sobre o sucesso ou falha das operações, para que eu possa informar o usuário e tomar ações apropriadas.

#### Acceptance Criteria

1. WHEN a tool invocation succeeds, THE MCP_Server SHALL return a success status with relevant data
2. WHEN a tool invocation fails due to validation errors, THE MCP_Server SHALL return an error with specific field information
3. WHEN a tool invocation fails due to no connected clients, THE MCP_Server SHALL return an error indicating unavailable printers
4. WHEN a WebSocket error occurs, THE MCP_Server SHALL log the error and return a descriptive message
5. WHEN an unexpected error occurs, THE MCP_Server SHALL return a generic error message without exposing internal details

### Requirement 8: Saiposprt Format Generation

**User Story:** Como desenvolvedor, eu quero gerar arquivos no formato .saiposprt corretamente, para que as impressoras térmicas possam processar os pedidos.

#### Acceptance Criteria

1. WHEN formatting Order_Data, THE MCP_Server SHALL encode the print data as JSON
2. WHEN JSON encoding is complete, THE MCP_Server SHALL encode the result in base64
3. WHEN base64 encoding is complete, THE MCP_Server SHALL wrap it in a data URL with charset utf-8
4. THE MCP_Server SHALL include print settings in the Saiposprt_Format (type, layout, rowColumns, fontSize, copies)
5. THE MCP_Server SHALL include print rows with formatted order information (header, items, totals, barcode)
6. WHEN generating the filename, THE MCP_Server SHALL use the order ID with .saiposprt extension

### Requirement 9: WebSocket Communication

**User Story:** Como desenvolvedor, eu quero manter comunicação confiável via WebSocket com os clientes, para que os arquivos de impressão sejam entregues corretamente.

#### Acceptance Criteria

1. THE MCP_Server SHALL accept WebSocket connections from Print_Clients
2. WHEN a Print_Client connects, THE MCP_Server SHALL register the connection and assign a unique ID
3. WHEN a Print_Client disconnects, THE MCP_Server SHALL remove the connection from the active list
4. WHEN sending print data, THE MCP_Server SHALL broadcast to all connected Print_Clients
5. WHEN a WebSocket error occurs, THE MCP_Server SHALL log the error and attempt to maintain other connections

### Requirement 10: Tool Documentation

**User Story:** Como LLM, eu quero ter acesso a documentação clara das ferramentas disponíveis, para que eu possa utilizá-las corretamente.

#### Acceptance Criteria

1. THE MCP_Server SHALL provide a description for each exposed tool
2. THE MCP_Server SHALL provide a JSON schema for each tool's input parameters
3. THE MCP_Server SHALL provide examples of valid input for each tool
4. THE MCP_Server SHALL document the expected output format for each tool
5. THE MCP_Server SHALL document possible error conditions for each tool
