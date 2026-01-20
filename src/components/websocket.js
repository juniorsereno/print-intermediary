/**
 * WebSocket Manager Component
 * Manages WebSocket connections and broadcasts data to connected clients
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
/**
 * WebSocketManager class
 * Manages WebSocket connections and handles broadcasting to connected clients
 */
export class WebSocketManager {
    io;
    clients;
    constructor(httpServer) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });
        this.clients = new Map();
    }
    /**
     * Initializes the WebSocket server and sets up event handlers
     * Requirements: 9.1
     */
    initialize() {
        this.io.on('connection', (socket) => {
            this.onConnection(socket);
        });
    }
    /**
     * Broadcasts data to all connected clients
     * @param data - The data to broadcast (typically Saiposprt formatted string)
     * @returns BroadcastResult with success status and client count
     *
     * Requirements: 9.4
     */
    broadcast(data) {
        try {
            const clientCount = this.clients.size;
            if (clientCount === 0) {
                return {
                    success: false,
                    clientCount: 0,
                    error: 'No clients connected'
                };
            }
            // Broadcast to all connected clients
            this.io.emit('download', data);
            return {
                success: true,
                clientCount
            };
        }
        catch (error) {
            // Requirement 9.5: Handle errors gracefully
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    getConnectedClients() {
        return Array.from(this.clients.values());
    }
    /**
     * Returns the number of connected clients
     * @returns Number of connected clients
     *
     * Requirements: 4.2
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Handles new client connections
     * @param socket - The Socket.io socket instance
     *
     * Requirements: 9.2
     */
    onConnection(socket) {
        // Generate unique client ID
        const clientId = uuidv4();
        // Register the client
        const clientInfo = {
            id: clientId,
            connectedAt: new Date(),
            socketId: socket.id
        };
        this.clients.set(clientId, clientInfo);
        console.log(`Client connected: ${clientId} (socket: ${socket.id})`);
        console.log(`Total clients: ${this.clients.size}`);
        // Handle disconnection
        socket.on('disconnect', () => {
            this.onDisconnect(clientId);
        });
        // Send confirmation to client
        socket.emit('connected', { clientId });
    }
    /**
     * Handles client disconnections
     * @param clientId - The unique client ID
     *
     * Requirements: 9.3
     */
    onDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            this.clients.delete(clientId);
            console.log(`Client disconnected: ${clientId}`);
            console.log(`Total clients: ${this.clients.size}`);
        }
    }
    /**
     * Closes the WebSocket server and disconnects all clients
     */
    close() {
        this.io.close();
        this.clients.clear();
    }
}
