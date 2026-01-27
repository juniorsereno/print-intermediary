#!/usr/bin/env node
/**
 * MCP Thermal Print Server
 * Implements the Model Context Protocol for thermal printing
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { DataValidator } from './components/validator.js';
import { SaiposFormatter } from './components/formatter.js';
import { WebSocketManager } from './components/websocket.js';
import { PrintHistory } from './components/history.js';
import { Logger } from './utils/logger.js';
import type { OrderData } from './types/models.js';

/**
 * Configuration for MCPThermalPrintServer
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  idStore: number;
  idUser: number;
}

/**
 * MCPThermalPrintServer class
 * Main server class that implements MCP protocol for thermal printing
 */
export class MCPThermalPrintServer {
  private server: McpServer;
  private transports: Map<string, StreamableHTTPServerTransport>;
  private validator: DataValidator;
  private formatter: SaiposFormatter;
  private wsManager: WebSocketManager | null;
  private history: PrintHistory;
  private logger: Logger;

  constructor(config: MCPServerConfig) {
    // Initialize MCP server
    this.server = new McpServer({
      name: config.name,
      version: config.version,
    });

    // Initialize components
    this.transports = new Map();
    this.validator = new DataValidator();
    this.formatter = new SaiposFormatter({
      idStore: config.idStore,
      idUser: config.idUser,
    });
    this.wsManager = null;
    this.history = new PrintHistory(1000);
    this.logger = new Logger('MCPThermalPrintServer');
    
    this.logger.info('MCP server instance created', { 
      name: config.name, 
      version: config.version 
    });
  }

  /**
   * Sets the WebSocket manager (must be called before starting)
   */
  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  /**
   * Initializes the MCP server and registers tools
   */
  async initialize(): Promise<void> {
    try {
      // Register send_print_job tool - Emitir Pedido
      this.server.tool(
        'emitir_pedido',
        `Emite um pedido para impressão na impressora térmica da pizzaria. Valida os dados do pedido, valor total do pedido é calculado automaticamente somando (quantidade × preço) de cada item + taxa de entrega.

IMPORTANTE - Como Informar Pizzas:

1. PIZZA INTEIRA (um sabor):
   - name: "Pizza Calabresa Grande"
   - name: "Pizza Mussarela Grande"
   - Todas as pizzas são tamanho Grande
   
2. PIZZA METADE/METADE (dois sabores):
   - name: "Pizza Calabresa/Mussarela Grande"
   - name: "Pizza Portuguesa/Frango Grande"
   - Formato: "Pizza Sabor1/Sabor2 Grande"
   - Use barra (/) para separar os dois sabores
   - Todas as pizzas são tamanho Grande
   
Exemplos de Itens:
- Pizza inteira: {"quantity": 1, "name": "Pizza Calabresa Grande", "price": 45.00}
- Pizza metade: {"quantity": 1, "name": "Pizza Calabresa/Mussarela Grande", "price": 45.00}
- Bebida: {"quantity": 2, "name": "Refrigerante 2L", "price": 10.00}

Formato de Saída:
{
  "success": true,
  "jobId": "uuid-string",
  "message": "Pedido enviado com sucesso para N impressora(s)",
  "clientCount": N
}

Condições de Erro:
- Retorna success: false se a validação falhar
- Retorna success: false se não houver impressoras conectadas
- Retorna campo error com detalhes da validação em caso de falha

Exemplo Completo:
Entrada: {
  "id": 123,
  "customer": "João Silva",
  "items": [
    {"quantity": 1, "name": "Pizza Calabresa Grande", "price": 45.00},
    {"quantity": 1, "name": "Pizza Portuguesa/Frango Grande", "price": 45.00},
    {"quantity": 1, "name": "Refrigerante 2L", "price": 10.00}
  ],
  "deliveryFee": 8.00
}
Saída: { "success": true, "jobId": "abc-123", "message": "Pedido enviado com sucesso para 1 impressora(s)", "clientCount": 1 }`,
        {
          id: z.number().positive().describe('ID único do pedido (deve ser um número inteiro positivo)'),
          customer: z.string().min(1).describe('Nome do cliente (não pode estar vazio)'),
          address: z.string().optional().describe('Endereço de entrega (opcional)'),
          items: z.array(z.object({
            quantity: z.number().positive().describe('Quantidade do item (deve ser positivo)'),
            name: z.string().describe('Nome do item. Para pizzas inteiras use "Pizza Sabor Grande" (ex: Pizza Calabresa Grande). Para pizzas metade/metade use "Pizza Sabor1/Sabor2 Grande" (ex: Pizza Calabresa/Mussarela Grande). Todas as pizzas são tamanho Grande. Para outros itens use o nome normal (ex: Refrigerante 2L)'),
            price: z.number().nonnegative().describe('Preço unitário do item (deve ser não-negativo)'),
          })).min(1).describe('Lista de itens do pedido (deve ter pelo menos um item)'),
          deliveryFee: z.number().nonnegative().optional().describe('Taxa de entrega em reais (opcional, padrão é 0 para retirada no local)'),
        },
        async (args) => await this.handleSendPrintJob(args)
      );

      this.logger.info('MCP server tools registered successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MCP server', error);
      throw new Error('MCP server initialization failed');
    }
  }

  /**
   * Converts a Zod object schema to JSON Schema format
   * @private
   */
  private zodToJsonSchema(zodSchema: any): any {
    if (!zodSchema || !zodSchema.def) {
      return { type: 'object', properties: {}, required: [] };
    }

    const def = zodSchema.def;
    
    // Handle object type
    if (def.type === 'object' && def.shape) {
      const properties: any = {};
      const required: string[] = [];

      // Process each property in the shape
      for (const [key, value] of Object.entries(def.shape)) {
        const propDef = (value as any).def;
        
        // Check if property is optional
        const isOptional = propDef && propDef.type === 'optional';
        
        if (!isOptional) {
          required.push(key);
        }
        
        // Convert property to JSON Schema
        properties[key] = this.zodPropertyToJsonSchema(value as any);
      }

      return {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      };
    }

    return { type: 'object', properties: {}, required: [] };
  }

  /**
   * Converts a single Zod property to JSON Schema
   * @private
   */
  private zodPropertyToJsonSchema(zodProp: any): any {
    if (!zodProp || !zodProp.def) {
      return {};
    }

    const def = zodProp.def;

    // Handle optional wrapper
    if (def.type === 'optional' && def.innerType) {
      const innerSchema = this.zodPropertyToJsonSchema(def.innerType);
      // Preserve description from the optional wrapper if it exists
      if (zodProp.description && !innerSchema.description) {
        innerSchema.description = zodProp.description;
      }
      return innerSchema;
    }

    // Handle basic types
    if (def.type === 'string') {
      const schema: any = { type: 'string' };
      if (zodProp.description) schema.description = zodProp.description;
      if (def.checks) {
        for (const check of def.checks) {
          if (check.minLength !== undefined) schema.minLength = check.minLength;
          if (check.maxLength !== undefined) schema.maxLength = check.maxLength;
        }
      }
      return schema;
    }

    if (def.type === 'number') {
      const schema: any = { type: 'number' };
      if (zodProp.description) schema.description = zodProp.description;
      if (def.checks) {
        for (const check of def.checks) {
          if (check.gt !== undefined) schema.exclusiveMinimum = check.gt;
          if (check.gte !== undefined) schema.minimum = check.gte;
          if (check.lt !== undefined) schema.exclusiveMaximum = check.lt;
          if (check.lte !== undefined) schema.maximum = check.lte;
        }
      }
      return schema;
    }

    if (def.type === 'array' && def.element) {
      const schema: any = {
        type: 'array',
        items: this.zodPropertyToJsonSchema(def.element),
      };
      if (zodProp.description) schema.description = zodProp.description;
      if (def.checks) {
        for (const check of def.checks) {
          if (check.minLength !== undefined) schema.minItems = check.minLength;
          if (check.maxLength !== undefined) schema.maxItems = check.maxLength;
        }
      }
      return schema;
    }

    if (def.type === 'object' && def.shape) {
      const objSchema = this.zodToJsonSchema(zodProp);
      if (zodProp.description) objSchema.description = zodProp.description;
      return objSchema;
    }

    // Fallback: return a basic schema with description if available
    const schema: any = {};
    if (zodProp.description) schema.description = zodProp.description;
    return schema;
  }

  /**
   * Gets tool definitions for testing purposes
   * @private
   */
  getToolDefinitions(): Array<{
    name: string;
    description: string;
    inputSchema: any;
  }> {
    // Access the internal registered tools from the MCP server
    const tools = (this.server as any)._registeredTools;
    
    if (!tools || typeof tools !== 'object') {
      return [];
    }

    // Convert object to array of tool definitions
    return Object.entries(tools).map(([name, tool]: [string, any]) => {
      // Convert Zod schema to JSON Schema
      let inputSchema = { type: 'object', properties: {}, required: [] };
      
      if (tool.inputSchema) {
        inputSchema = this.zodToJsonSchema(tool.inputSchema);
      }
      
      return {
        name,
        description: tool.description || '',
        inputSchema,
      };
    });
  }

  /**
   * Starts the MCP server
   */
  async start(): Promise<void> {
    this.logger.info('MCP Thermal Print Server ready');
  }

  /**
   * Connects a transport to the MCP server
   */
  async connectTransport(transport: StreamableHTTPServerTransport): Promise<void> {
    await this.server.connect(transport);
  }

  /**
   * Creates a new transport (deprecated - use connectTransport instead)
   */
  async createTransport(): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (newSessionId) => {
        this.logger.info('New MCP session initialized', { sessionId: newSessionId });
        this.transports.set(newSessionId, transport);
      },
    });

    await this.server.connect(transport);

    transport.onclose = () => {
      const sid = Array.from(this.transports.entries()).find(([_, t]) => t === transport)?.[0];
      if (sid) {
        this.logger.info('MCP session closed', { sessionId: sid });
        this.transports.delete(sid);
      }
    };

    return transport;
  }

  /**
   * Handles send_print_job tool invocation
   */
  private async handleSendPrintJob(args: any): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    try {
      this.logger.info('Processing send_print_job request');
      
      // Validate order data
      const validationResult = this.validator.validateOrderData(args);
      
      if (!validationResult.success) {
        this.logger.warn('Print job validation failed', { 
          error: validationResult.error,
          field: validationResult.field 
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: validationResult.error,
              field: validationResult.field,
            }),
          }],
        };
      }

      const orderData = validationResult.data as OrderData;

      // Check if clients are connected
      if (!this.wsManager || this.wsManager.getClientCount() === 0) {
        this.logger.warn('Print job rejected - no clients connected', { orderId: orderData.id });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: 'Nenhuma impressora conectada',
            }),
          }],
        };
      }

      // Format order data to Saiposprt
      const formattedData = this.formatter.format(orderData);

      // Broadcast to connected clients
      const broadcastResult = this.wsManager.broadcast(formattedData);

      if (!broadcastResult.success) {
        const job = this.history.add({
          orderId: orderData.id,
          customer: orderData.customer,
          total: orderData.total,
          status: 'failed',
          clientCount: 0,
        });

        this.logger.error('Print job broadcast failed', undefined, { 
          jobId: job.id,
          orderId: orderData.id,
          error: broadcastResult.error 
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: broadcastResult.error || 'Falha ao enviar pedido',
              jobId: job.id,
            }),
          }],
        };
      }

      // Add successful job to history
      const job = this.history.add({
        orderId: orderData.id,
        customer: orderData.customer,
        total: orderData.total,
        status: 'sent',
        clientCount: broadcastResult.clientCount,
      });

      this.logger.info('Print job sent successfully', { 
        jobId: job.id,
        orderId: orderData.id,
        clientCount: broadcastResult.clientCount 
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            jobId: job.id,
            message: `Pedido enviado com sucesso para ${broadcastResult.clientCount} impressora(s)`,
            clientCount: broadcastResult.clientCount,
          }),
        }],
      };
    } catch (error) {
      this.logger.error('Unexpected error in send_print_job', error);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Ocorreu um erro inesperado ao processar o pedido',
          }),
        }],
      };
    }
  }
}

