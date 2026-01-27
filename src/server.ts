/**
 * MCP Thermal Print Server
 * Implements the Model Context Protocol for thermal printing
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import crypto from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
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
  private server: Server;
  private transport: StreamableHTTPServerTransport;
  private validator: DataValidator;
  private formatter: SaiposFormatter;
  private wsManager: WebSocketManager | null;
  private history: PrintHistory;
  private logger: Logger;

  constructor(config: MCPServerConfig) {
    // Initialize transport first
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize components
    this.validator = new DataValidator();
    this.formatter = new SaiposFormatter({
      idStore: config.idStore,
      idUser: config.idUser,
    });
    this.wsManager = null; // Will be set when HTTP server is provided
    this.history = new PrintHistory(1000);
    this.logger = new Logger('MCPThermalPrintServer');
    
    this.logger.info('MCP server instance created', { 
      name: config.name, 
      version: config.version 
    });
  }

  /**
   * Sets the WebSocket manager (must be called before starting)
   * @param wsManager - WebSocket manager instance
   */
  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  /**
   * Initializes the MCP server and registers tools
   * Requirements: 1.1, 1.2, 7.4
   */
  async initialize(): Promise<void> {
    try {
      // Register tool list handler
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        this.logger.debug('Tool list requested');
        return {
          tools: this.getToolDefinitions(),
        };
      });

      // Register tool call handler
      this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        this.logger.info('Tool invoked', { toolName: name });

        try {
          switch (name) {
            case 'send_print_job':
              return await this.handleSendPrintJob(args);
            case 'check_printer_status':
              return await this.handleCheckPrinterStatus();
            case 'get_print_history':
              return await this.handleGetPrintHistory(args);
            default:
              this.logger.warn('Unknown tool requested', { toolName: name });
              throw new Error(`Unknown tool: ${name}`);
          }
        } catch (error) {
          this.logger.error('Tool invocation failed', error, { toolName: name });
          throw error;
        }
      });

      this.logger.info('MCP server initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MCP server', error);
      throw new Error('MCP server initialization failed');
    }
  }

  /**
   * Starts the MCP server with HTTP Streamable transport
   * Requirements: 1.5, 7.4
   */
  async start(): Promise<void> {
    try {
      await this.server.connect(this.transport);
      this.logger.info('MCP Thermal Print Server started with Streamable HTTP transport');
      console.error('MCP Thermal Print Server started with Streamable HTTP transport');
    } catch (error) {
      this.logger.error('Failed to start MCP server', error);
      throw new Error('Failed to start MCP server');
    }
  }

  /**
   * Returns the transport instance for handling HTTP requests
   */
  getTransport(): StreamableHTTPServerTransport {
    return this.transport;
  }

  /**
   * Returns tool definitions for MCP discovery
   * Requirements: 1.2, 10.1, 10.2, 10.3, 10.4, 10.5
   */
  private getToolDefinitions(): Tool[] {
    return [
      {
        name: 'send_print_job',
        description: `Sends a print job to connected thermal printers. This tool validates order data, formats it into Saiposprt format, and broadcasts to all connected print clients via WebSocket.

**Purpose:** Submit orders for thermal printing to connected printer clients.

**Input Example:**
{
  "id": 12345,
  "customer": "João Silva",
  "address": "Rua das Flores, 123",
  "items": [
    { "quantity": 2, "name": "Pizza Margherita", "price": 35.00 },
    { "quantity": 1, "name": "Refrigerante 2L", "price": 8.00 }
  ],
  "deliveryFee": 5.00,
  "total": 83.00
}

**Output Format:**
Success: { "success": true, "jobId": "uuid", "message": "Print job sent successfully to N client(s)", "clientCount": N }
Validation Error: { "success": false, "error": "error description", "field": "field_name" }
No Clients: { "success": false, "message": "No printers connected" }

**Error Conditions:**
- Invalid order ID (must be positive integer)
- Empty customer name
- Empty items array
- Invalid item quantity (must be positive)
- Invalid item price (must be non-negative)
- No printer clients connected
- WebSocket broadcast failure`,
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'Unique order ID (must be a positive integer)',
            },
            customer: {
              type: 'string',
              description: 'Customer name (cannot be empty)',
            },
            address: {
              type: 'string',
              description: 'Delivery address (optional)',
            },
            items: {
              type: 'array',
              description: 'List of items in the order (must have at least one item)',
              items: {
                type: 'object',
                properties: {
                  quantity: {
                    type: 'number',
                    description: 'Quantity of the item (must be positive)',
                  },
                  name: {
                    type: 'string',
                    description: 'Name/description of the item',
                  },
                  price: {
                    type: 'number',
                    description: 'Unit price of the item (must be non-negative)',
                  },
                },
                required: ['quantity', 'name', 'price'],
              },
            },
            deliveryFee: {
              type: 'number',
              description: 'Delivery/shipping fee (optional, defaults to 0 if not provided)',
            },
            total: {
              type: 'number',
              description: 'Total order value (OPTIONAL - will be calculated automatically by summing items + deliveryFee. You can omit this field.)',
            },
          },
          required: ['id', 'customer', 'items'],
        },
      },
      {
        name: 'check_printer_status',
        description: `Checks the connection status of thermal printer clients. Returns the number of connected clients and their connection details (ID and connection time).

**Purpose:** Verify printer availability before sending print jobs.

**Input Example:**
{}

**Output Format:**
Success: { "connectedClients": N, "clients": [{ "id": "client-uuid", "connectedAt": "2024-01-15T10:30:00.000Z" }] }
No Clients: { "connectedClients": 0, "clients": [] }

**Error Conditions:**
- WebSocket manager not initialized (returns 0 clients)
- Internal error retrieving status (returns error field with message)`,
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_print_history',
        description: `Retrieves the history of recent print jobs. Returns job details including ID, order ID, customer name, total value, timestamp, status, and client count. Maximum 1000 entries are stored in memory.

**Purpose:** Query recent print job history for monitoring and debugging.

**Input Example:**
{ "limit": 10 }

**Output Format:**
Success: {
  "jobs": [
    {
      "id": "job-uuid",
      "orderId": 12345,
      "customer": "João Silva",
      "total": 83.00,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "status": "sent",
      "clientCount": 2
    }
  ],
  "total": 150,
  "limit": 10
}

**Error Conditions:**
- Invalid limit (uses default of 50)
- Internal error retrieving history (returns empty jobs array with error field)

**Notes:**
- Default limit: 50 jobs
- Maximum limit: 1000 jobs
- History is stored in memory (not persisted)
- Circular buffer: oldest entries are removed when limit is exceeded`,
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of jobs to return (default: 50, max: 1000)',
            },
          },
        },
      },
    ];
  }

  /**
   * Handles send_print_job tool invocation
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.1, 7.2, 7.3, 7.5
   */
  private async handleSendPrintJob(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      this.logger.info('Processing send_print_job request');
      
      // Validate order data
      const validationResult = this.validator.validateOrderData(args);
      
      if (!validationResult.success) {
        // Requirement 7.2: Return validation error
        this.logger.warn('Print job validation failed', { 
          error: validationResult.error,
          field: validationResult.field 
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: validationResult.error,
                field: validationResult.field,
              }),
            },
          ],
        };
      }

      const orderData = validationResult.data as OrderData;

      // Check if clients are connected
      if (!this.wsManager || this.wsManager.getClientCount() === 0) {
        // Requirement 2.5, 7.3: Return error when no clients connected
        this.logger.warn('Print job rejected - no clients connected', { orderId: orderData.id });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'No printers connected',
              }),
            },
          ],
        };
      }

      // Format order data to Saiposprt
      const formattedData = this.formatter.format(orderData);

      // Broadcast to connected clients
      const broadcastResult = this.wsManager.broadcast(formattedData);

      if (!broadcastResult.success) {
        // Add failed job to history
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
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: broadcastResult.error || 'Broadcast failed',
                jobId: job.id,
              }),
            },
          ],
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

      // Requirement 2.6, 7.1: Return success response
      this.logger.info('Print job sent successfully', { 
        jobId: job.id,
        orderId: orderData.id,
        clientCount: broadcastResult.clientCount 
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              jobId: job.id,
              message: `Print job sent successfully to ${broadcastResult.clientCount} client(s)`,
              clientCount: broadcastResult.clientCount,
            }),
          },
        ],
      };
    } catch (error) {
      // Requirement 7.5: Handle unexpected errors without exposing internals
      this.logger.error('Unexpected error in send_print_job', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'An unexpected error occurred while processing the print job',
            }),
          },
        ],
      };
    }
  }

  /**
   * Handles check_printer_status tool invocation
   * Requirements: 4.1, 4.2, 4.3, 4.4, 7.5
   */
  private async handleCheckPrinterStatus(): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      this.logger.debug('Processing check_printer_status request');
      
      if (!this.wsManager) {
        this.logger.warn('WebSocket manager not initialized');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                connectedClients: 0,
                clients: [],
              }),
            },
          ],
        };
      }

      const clientCount = this.wsManager.getClientCount();
      const clients = this.wsManager.getConnectedClients();

      // Format client info for response
      const clientsInfo = clients.map((client) => ({
        id: client.id,
        connectedAt: client.connectedAt.toISOString(),
      }));

      this.logger.info('Printer status retrieved', { clientCount });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              connectedClients: clientCount,
              clients: clientsInfo,
            }),
          },
        ],
      };
    } catch (error) {
      // Requirement 7.5: Handle errors safely
      this.logger.error('Error retrieving printer status', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              connectedClients: 0,
              clients: [],
              error: 'Failed to retrieve printer status',
            }),
          },
        ],
      };
    }
  }

  /**
   * Handles get_print_history tool invocation
   * Requirements: 5.1, 5.2, 5.3, 5.4, 7.5
   */
  private async handleGetPrintHistory(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      this.logger.debug('Processing get_print_history request');
      
      // Extract and validate limit parameter
      const argsObj = (args as { limit?: number }) || {};
      let limit = argsObj.limit !== undefined ? argsObj.limit : 50;

      // Validate limit
      const limitValidation = this.validator.validateHistoryLimit(limit);
      if (!limitValidation.success) {
        // Use default if validation fails
        this.logger.warn('Invalid history limit, using default', { 
          providedLimit: limit,
          defaultLimit: 50 
        });
        limit = 50;
      } else {
        limit = limitValidation.data as number;
      }

      // Get recent jobs
      const jobs = this.history.getRecent(limit);

      // Format jobs for response
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
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              jobs: jobsInfo,
              total: this.history.getCount(),
              limit: limit,
            }),
          },
        ],
      };
    } catch (error) {
      // Requirement 7.5: Handle errors safely
      this.logger.error('Error retrieving print history', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              jobs: [],
              total: 0,
              limit: 50,
              error: 'Failed to retrieve print history',
            }),
          },
        ],
      };
    }
  }
}
