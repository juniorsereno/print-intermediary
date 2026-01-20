/**
 * MCP Thermal Print Server
 * Implements the Model Context Protocol for thermal printing
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
  private validator: DataValidator;
  private formatter: SaiposFormatter;
  private wsManager: WebSocketManager | null;
  private history: PrintHistory;
  private logger: Logger;

  constructor(config: MCPServerConfig) {
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
   * Starts the MCP server
   * Requirements: 1.5, 7.4
   */
  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logger.info('MCP Thermal Print Server started');
      console.error('MCP Thermal Print Server started');
    } catch (error) {
      this.logger.error('Failed to start MCP server', error);
      throw new Error('Failed to start MCP server');
    }
  }

  /**
   * Returns tool definitions for MCP discovery
   * Requirements: 1.2, 10.1, 10.2, 10.3, 10.4, 10.5
   */
  private getToolDefinitions(): Tool[] {
    return [
      {
        name: 'send_print_job',
        description: 'Sends a print job to connected thermal printers. Validates order data, formats it into Saiposprt format, and broadcasts to all connected print clients via WebSocket.',
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
            total: {
              type: 'number',
              description: 'Total order value (must be non-negative)',
            },
          },
          required: ['id', 'customer', 'items', 'total'],
        },
      },
      {
        name: 'check_printer_status',
        description: 'Checks the connection status of thermal printer clients. Returns the number of connected clients and their connection details (ID and connection time).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_print_history',
        description: 'Retrieves the history of recent print jobs. Returns job details including ID, order ID, customer name, total value, timestamp, status, and client count. Maximum 1000 entries are stored.',
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
