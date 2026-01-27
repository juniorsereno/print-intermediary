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
      // Register send_print_job tool
      this.server.tool(
        'send_print_job',
        `Sends a print job to connected thermal printers. Validates order data, formats it into Saiposprt format, and broadcasts to all connected print clients via WebSocket.

Output Format:
{
  "success": true,
  "jobId": "uuid-string",
  "message": "Print job sent successfully to N client(s)",
  "clientCount": N
}

Error Conditions:
- Returns success: false if validation fails
- Returns success: false if no printers are connected
- Returns error field with validation details on failure

Example:
Input: { "id": 123, "customer": "John Doe", "items": [{"quantity": 2, "name": "Pizza", "price": 15.00}], "total": 30.00 }
Output: { "success": true, "jobId": "abc-123", "message": "Print job sent successfully to 1 client(s)", "clientCount": 1 }`,
        {
          id: z.number().positive().describe('Unique order ID (must be a positive integer)'),
          customer: z.string().min(1).describe('Customer name (cannot be empty)'),
          address: z.string().optional().describe('Delivery address (optional)'),
          items: z.array(z.object({
            quantity: z.number().positive().describe('Quantity of the item (must be positive)'),
            name: z.string().describe('Name/description of the item'),
            price: z.number().nonnegative().describe('Unit price of the item (must be non-negative)'),
          })).min(1).describe('List of items in the order (must have at least one item)'),
          deliveryFee: z.number().nonnegative().optional().describe('Delivery/shipping fee (optional, defaults to 0)'),
          total: z.number().nonnegative().optional().describe('Total order value (OPTIONAL - will be calculated automatically)'),
        },
        async (args) => await this.handleSendPrintJob(args)
      );

      // Register check_printer_status tool
      this.server.tool(
        'check_printer_status',
        `Checks the connection status of thermal printer clients. Returns the number of connected clients and their connection details.

Output Format:
{
  "connectedClients": N,
  "clients": [
    {
      "id": "uuid-string",
      "connectedAt": "ISO-8601-timestamp"
    }
  ]
}

Error Conditions:
- Returns connectedClients: 0 if WebSocket manager is not initialized
- Returns error field if status retrieval fails

Example:
Output: { "connectedClients": 2, "clients": [{"id": "abc-123", "connectedAt": "2024-01-01T00:00:00.000Z"}] }`,
        {},
        async () => await this.handleCheckPrinterStatus()
      );

      // Register get_print_history tool
      this.server.tool(
        'get_print_history',
        `Retrieves the history of recent print jobs. Returns job details including ID, order ID, customer name, total value, timestamp, status, and client count.

Output Format:
{
  "jobs": [
    {
      "id": "uuid-string",
      "orderId": number,
      "customer": "string",
      "total": number,
      "timestamp": "ISO-8601-timestamp",
      "status": "sent" | "failed",
      "clientCount": number
    }
  ],
  "total": number,
  "limit": number
}

Error Conditions:
- Returns empty jobs array if no history exists
- Returns error field if history retrieval fails
- Invalid limit values are replaced with default (50)

Example:
Input: { "limit": 10 }
Output: { "jobs": [...], "total": 100, "limit": 10 }`,
        {
          limit: z.number().min(1).max(1000).optional().describe('Maximum number of jobs to return (default: 50, max: 1000)'),
        },
        async (args) => await this.handleGetPrintHistory(args)
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
              message: 'No printers connected',
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
              message: broadcastResult.error || 'Broadcast failed',
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
            message: `Print job sent successfully to ${broadcastResult.clientCount} client(s)`,
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
            error: 'An unexpected error occurred while processing the print job',
          }),
        }],
      };
    }
  }

  /**
   * Handles check_printer_status tool invocation
   */
  private async handleCheckPrinterStatus(): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    try {
      this.logger.debug('Processing check_printer_status request');
      
      if (!this.wsManager) {
        this.logger.warn('WebSocket manager not initialized');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              connectedClients: 0,
              clients: [],
            }),
          }],
        };
      }

      const clientCount = this.wsManager.getClientCount();
      const clients = this.wsManager.getConnectedClients();

      const clientsInfo = clients.map((client) => ({
        id: client.id,
        connectedAt: client.connectedAt.toISOString(),
      }));

      this.logger.info('Printer status retrieved', { clientCount });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            connectedClients: clientCount,
            clients: clientsInfo,
          }),
        }],
      };
    } catch (error) {
      this.logger.error('Error retrieving printer status', error);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            connectedClients: 0,
            clients: [],
            error: 'Failed to retrieve printer status',
          }),
        }],
      };
    }
  }

  /**
   * Handles get_print_history tool invocation
   */
  private async handleGetPrintHistory(args: any): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    try {
      this.logger.debug('Processing get_print_history request');
      
      let limit = args.limit !== undefined ? args.limit : 50;

      const limitValidation = this.validator.validateHistoryLimit(limit);
      if (!limitValidation.success) {
        this.logger.warn('Invalid history limit, using default', { 
          providedLimit: limit,
          defaultLimit: 50 
        });
        limit = 50;
      } else {
        limit = limitValidation.data as number;
      }

      const jobs = this.history.getRecent(limit);

      const jobsInfo = jobs.map((job) => ({
        id: job.id,
        orderId: job.orderId,
        customer: job.customer,
        total: job.total,
        timestamp: job.timestamp.toISOString(),
        status: job.status,
        clientCount: job.clientCount,
      }));

      this.logger.info('Print history retrieved', { 
        jobCount: jobs.length,
        limit 
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            jobs: jobsInfo,
            total: this.history.getCount(),
            limit: limit,
          }),
        }],
      };
    } catch (error) {
      this.logger.error('Error retrieving print history', error);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            jobs: [],
            total: 0,
            limit: 50,
            error: 'Failed to retrieve print history',
          }),
        }],
      };
    }
  }
}
