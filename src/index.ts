/**
 * MCP Thermal Print Server Entry Point
 * Initializes and starts the complete server with HTTP, WebSocket, and MCP support
 * Requirements: 1.1, 1.5
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { DataValidator } from './components/validator.js';
import { SaiposFormatter } from './components/formatter.js';
import { WebSocketManager } from './components/websocket.js';
import { PrintHistory } from './components/history.js';
import { LegacyHttpHandler } from './components/legacy.js';
import { Logger } from './utils/logger.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from environment variables
const PORT = parseInt(process.env.PORT || '3000', 10);
const ID_STORE = parseInt(process.env.ID_STORE || '72144', 10);
const ID_USER = parseInt(process.env.ID_USER || '1', 10);

const logger = new Logger('Main');

async function startServer() {
  try {
    logger.info('Starting MCP Thermal Print Server', { 
      port: PORT, 
      idStore: ID_STORE, 
      idUser: ID_USER 
    });

    // Create Express app and HTTP server
    const app = express();
    const httpServer = http.createServer(app);

    // Initialize components
    const validator = new DataValidator();
    const formatter = new SaiposFormatter({ idStore: ID_STORE, idUser: ID_USER });
    const wsManager = new WebSocketManager(httpServer);
    const history = new PrintHistory(1000);
    const legacyHandler = new LegacyHttpHandler(validator, formatter, wsManager, history);

    // Initialize WebSocket
    wsManager.initialize();
    logger.info('WebSocket manager initialized');

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Serve static files from public directory
    const publicPath = path.join(__dirname, '../public');
    app.use(express.static(publicPath));
    logger.info('Static files served from', { path: publicPath });

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        connectedClients: wsManager.getClientCount(),
        historyCount: history.getCount()
      });
    });

    // Status endpoint
    app.get('/api/status', (_req, res) => {
      const clients = wsManager.getConnectedClients();
      res.json({
        connectedClients: wsManager.getClientCount(),
        clients: clients.map(c => ({
          id: c.id,
          connectedAt: c.connectedAt.toISOString()
        })),
        historyCount: history.getCount()
      });
    });

    // History endpoint
    app.get('/api/history', (req, res) => {
      const limit = parseInt(req.query.limit as string || '50', 10);
      const jobs = history.getRecent(limit);
      
      res.json({
        jobs: jobs.map(job => ({
          id: job.id,
          orderId: job.orderId,
          customer: job.customer,
          total: job.total,
          timestamp: job.timestamp.toISOString(),
          status: job.status,
          clientCount: job.clientCount
        })),
        total: history.getCount(),
        limit
      });
    });

    // Legacy print endpoint
    app.post('/api/print', (req, res) => legacyHandler.handlePrintRequest(req, res));

    // Root endpoint - redirect to client page
    app.get('/', (_req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });

    // Error handling middleware
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error('Express error handler', err);
      res.status(500).json({
        success: false,
        error: 'An unexpected error occurred'
      });
    });

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info('Server started successfully', { 
        port: PORT,
        endpoints: {
          health: `http://localhost:${PORT}/health`,
          status: `http://localhost:${PORT}/api/status`,
          print: `http://localhost:${PORT}/api/print`,
          history: `http://localhost:${PORT}/api/history`,
          websocket: `ws://localhost:${PORT}`
        }
      });
      console.log(`\n🚀 MCP Thermal Print Server running on port ${PORT}`);
      console.log(`📊 Status: http://localhost:${PORT}/api/status`);
      console.log(`🖨️  Print: POST http://localhost:${PORT}/api/print`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`🌐 Client: http://localhost:${PORT}/\n`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down server...');
      
      wsManager.close();
      
      httpServer.close(() => {
        logger.info('Server shut down successfully');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer();
