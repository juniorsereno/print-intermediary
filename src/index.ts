#!/usr/bin/env node
/**
 * MCP Thermal Print Server Entry Point
 * Initializes and starts the complete server with HTTP, WebSocket, and MCP support
 * Requirements: 1.1, 1.5
 */

import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { DataValidator } from './components/validator.js';
import { SaiposFormatter } from './components/formatter.js';
import { WebSocketManager } from './components/websocket.js';
import { PrintHistory } from './components/history.js';
import { LegacyHttpHandler } from './components/legacy.js';
import { MCPThermalPrintServer } from './server.js';
import { Logger } from './utils/logger.js';
import { getConfig } from './config.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = new Logger('Main');

// Load and validate configuration
const config = getConfig();

async function startServer() {
  try {
    logger.info('Starting MCP Thermal Print Server', { 
      port: config.port, 
      idStore: config.idStore, 
      idUser: config.idUser,
      maxHistorySize: config.maxHistorySize
    });

    // Create Express app and HTTP server
    const app = express();
    const httpServer = http.createServer(app);

    // Initialize components
    const validator = new DataValidator();
    const formatter = new SaiposFormatter({ idStore: config.idStore, idUser: config.idUser });
    const wsManager = new WebSocketManager(httpServer);
    const history = new PrintHistory(config.maxHistorySize);
    const legacyHandler = new LegacyHttpHandler(validator, formatter, wsManager, history);

    // Initialize MCP server
    const mcpServer = new MCPThermalPrintServer({
      name: config.serverName,
      version: config.serverVersion,
      idStore: config.idStore,
      idUser: config.idUser,
    });
    mcpServer.setWebSocketManager(wsManager);
    await mcpServer.initialize();
    await mcpServer.start();

    // Initialize WebSocket
    wsManager.initialize();
    logger.info('WebSocket manager initialized');

    // Armazena transportes MCP ativos
    const transports = new Map<string, StreamableHTTPServerTransport>();

    // Middleware - NÃO aplicar no endpoint /mcp
    app.use((req, res, next) => {
      if (req.path === '/mcp') {
        return next();
      }
      express.json()(req, res, next);
    });
    app.use((req, res, next) => {
      if (req.path === '/mcp') {
        return next();
      }
      express.urlencoded({ extended: true })(req, res, next);
    });

    // Serve static files from public directory
    const publicPath = path.join(__dirname, '../public');
    app.use(express.static(publicPath));
    logger.info('Static files served from', { path: publicPath });

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({ 
        status: 'ok', 
        transport: 'streamable-http',
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

    // MCP endpoint - ÚNICO endpoint para todas as operações
    app.all('/mcp', async (req: Request, res: Response) => {
      logger.debug('MCP request', { method: req.method, sessionId: req.headers['mcp-session-id'] });
      
      try {
        // Obtém ou cria session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports.has(sessionId)) {
          // Reutiliza transporte existente
          transport = transports.get(sessionId)!;
          logger.debug('Reusing MCP session', { sessionId });
        } else if (req.method === 'POST' || req.method === 'GET') {
          // Cria novo transporte para nova sessão
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (newSessionId) => {
              logger.info('MCP session initialized', { sessionId: newSessionId });
              transports.set(newSessionId, transport);
            },
          });

          // Conecta o servidor MCP ao transporte
          await mcpServer.connectTransport(transport);

          // Limpa sessão quando fechada
          transport.onclose = () => {
            const sid = Array.from(transports.entries()).find(([_, t]) => t === transport)?.[0];
            if (sid) {
              logger.info('MCP session closed', { sessionId: sid });
              transports.delete(sid);
            }
          };
        } else if (req.method === 'DELETE') {
          // Handle session termination
          if (sessionId && transports.has(sessionId)) {
            const transport = transports.get(sessionId)!;
            await transport.close();
            transports.delete(sessionId);
            logger.info('MCP session terminated', { sessionId });
            res.status(200).json({ message: 'Session terminated' });
          } else {
            res.status(404).json({ error: 'Session not found' });
          }
          return;
        } else {
          res.status(400).json({ error: 'Bad Request: Invalid method' });
          return;
        }

        // Delega o handling para o transporte
        await transport.handleRequest(req, res);
      } catch (error: any) {
        logger.error('MCP request error', error);
        if (!res.headersSent) {
          res.status(500).json({ error: error.message || 'Internal server error' });
        }
      }
    });

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
    httpServer.listen(config.port, () => {
      logger.info('Server started successfully', { 
        port: config.port,
        endpoints: {
          health: `http://localhost:${config.port}/health`,
          status: `http://localhost:${config.port}/api/status`,
          print: `http://localhost:${config.port}/api/print`,
          history: `http://localhost:${config.port}/api/history`,
          mcp: `http://localhost:${config.port}/mcp`,
          websocket: `ws://localhost:${config.port}`
        }
      });
      console.log(`\n🚀 MCP Thermal Print Server running on port ${config.port}`);
      console.log(`📊 Health: http://localhost:${config.port}/health`);
      console.log(`📊 Status: http://localhost:${config.port}/api/status`);
      console.log(`🖨️  Print: POST http://localhost:${config.port}/api/print`);
      console.log(`🤖 MCP: http://localhost:${config.port}/mcp`);
      console.log(`🔌 WebSocket: ws://localhost:${config.port}`);
      console.log(`🌐 Client: http://localhost:${config.port}/\n`);
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
