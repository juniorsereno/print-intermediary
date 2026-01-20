/**
 * WebSocket Manager Component
 * Manages WebSocket connections and broadcasts data to connected clients
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 7.4
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import type { ClientInfo } from '../types/models.js';
import { Logger } from '../utils/logger.js';

/**
 * Result of a broadcast operation
 */
export interface BroadcastResult {
  /** Whether the broadcast was successful */
  success: boolean;
  /** Number of clients that received the data */
  clientCount: number;
  /** Error message if broadcast failed */
  error?: string;
}

/**
 * WebSocketManager class
 * Manages WebSocket connections and handles broadcasting to connected clients
 */
export class WebSocketManager {
  private io: SocketIOServer;
  private clients: Map<string, ClientInfo>;
  private logger: Logger;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    this.clients = new Map();
    this.logger = new Logger('WebSocketManager');
  }

  /**
   * Initializes the WebSocket server and sets up event handlers
   * Requirements: 9.1, 7.4
   */
  initialize(): void {
    try {
      this.io.on('connection', (socket: Socket) => {
        this.onConnection(socket);
      });

      this.io.on('error', (error: Error) => {
        this.logger.error('WebSocket server error', error);
      });

      this.logger.info('WebSocket server initialized');
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket server', error);
      throw new Error('WebSocket initialization failed');
    }
  }

  /**
   * Broadcasts data to all connected clients
   * @param data - The data to broadcast (typically Saiposprt formatted string)
   * @returns BroadcastResult with success status and client count
   * 
   * Requirements: 9.4, 9.5, 7.4
   */
  broadcast(data: string): BroadcastResult {
    try {
      const clientCount = this.clients.size;

      if (clientCount === 0) {
        this.logger.warn('Broadcast attempted with no clients connected');
        return {
          success: false,
          clientCount: 0,
          error: 'No clients connected'
        };
      }

      // Broadcast to all connected clients
      this.io.emit('download', data);

      this.logger.info('Data broadcasted successfully', { 
        clientCount,
        dataLength: data.length 
      });

      return {
        success: true,
        clientCount
      };
    } catch (error) {
      // Requirement 9.5, 7.4: Handle errors gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Broadcast failed', error, { clientCount: this.clients.size });
      
      return {
        success: false,
        clientCount: this.clients.size,
        error: `Broadcast failed: ${errorMessage}`
      };
    }
  }

  /**
   * Returns information about all connected clients
   * @returns Array of ClientInfo objects
   * 
   * Requirements: 4.3
   */
  getConnectedClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Returns the number of connected clients
   * @returns Number of connected clients
   * 
   * Requirements: 4.2
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Handles new client connections
   * @param socket - The Socket.io socket instance
   * 
   * Requirements: 9.2, 7.4
   */
  private onConnection(socket: Socket): void {
    try {
      // Generate unique client ID
      const clientId = uuidv4();
      
      // Register the client
      const clientInfo: ClientInfo = {
        id: clientId,
        connectedAt: new Date(),
        socketId: socket.id
      };
      
      this.clients.set(clientId, clientInfo);
      
      this.logger.info('Client connected', { 
        clientId, 
        socketId: socket.id,
        totalClients: this.clients.size 
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.onDisconnect(clientId);
      });

      // Handle socket errors
      socket.on('error', (error: Error) => {
        this.logger.error('Socket error', error, { clientId, socketId: socket.id });
      });

      // Send confirmation to client
      socket.emit('connected', { clientId });
    } catch (error) {
      this.logger.error('Error handling client connection', error, { socketId: socket.id });
    }
  }

  /**
   * Handles client disconnections
   * @param clientId - The unique client ID
   * 
   * Requirements: 9.3, 7.4
   */
  private onDisconnect(clientId: string): void {
    try {
      const client = this.clients.get(clientId);
      
      if (client) {
        this.clients.delete(clientId);
        this.logger.info('Client disconnected', { 
          clientId,
          totalClients: this.clients.size 
        });
      } else {
        this.logger.warn('Disconnect event for unknown client', { clientId });
      }
    } catch (error) {
      this.logger.error('Error handling client disconnection', error, { clientId });
    }
  }

  /**
   * Closes the WebSocket server and disconnects all clients
   * 
   * Requirements: 7.4
   */
  close(): void {
    try {
      this.logger.info('Closing WebSocket server', { clientCount: this.clients.size });
      this.io.close();
      this.clients.clear();
      this.logger.info('WebSocket server closed');
    } catch (error) {
      this.logger.error('Error closing WebSocket server', error);
    }
  }
}
