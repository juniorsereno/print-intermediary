/**
 * Unit tests for Legacy HTTP Handler
 * Feature: mcp-thermal-print-server
 * Requirements: 6.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import { Server as HttpServer } from 'http';
import request from 'supertest';
import { DataValidator } from '../src/components/validator.js';
import { SaiposFormatter } from '../src/components/formatter.js';
import { WebSocketManager } from '../src/components/websocket.js';
import { PrintHistory } from '../src/components/history.js';
import { LegacyHttpHandler } from '../src/components/legacy.js';

describe('Legacy HTTP Handler Unit Tests', () => {
  let app: Express;
  let httpServer: HttpServer;
  let wsManager: WebSocketManager;
  let validator: DataValidator;
  let formatter: SaiposFormatter;
  let history: PrintHistory;
  let legacyHandler: LegacyHttpHandler;

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());

    // Create HTTP server
    httpServer = new HttpServer(app);

    // Initialize components
    validator = new DataValidator();
    formatter = new SaiposFormatter({ idStore: 12345, idUser: 67890 });
    history = new PrintHistory(1000);
    wsManager = new WebSocketManager(httpServer);
    wsManager.initialize();

    // Setup legacy handler
    legacyHandler = new LegacyHttpHandler(validator, formatter, wsManager, history);
    app.post('/api/print', (req, res) => legacyHandler.handlePrintRequest(req, res));
  });

  afterEach(() => {
    if (httpServer) {
      httpServer.close();
    }
    if (wsManager) {
      wsManager.close();
    }
  });

  describe('POST /api/print with valid data', () => {
    it('should return 503 when no clients are connected', async () => {
      const validOrder = {
        id: 123,
        customer: 'John Doe',
        address: '123 Main St',
        items: [
          { quantity: 2, name: 'Pizza', price: 15.99 }
        ],
        total: 31.98
      };

      const response = await request(app)
        .post('/api/print')
        .send(validOrder)
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No printers connected');
    });

    it('should accept valid order data with all fields', async () => {
      const validOrder = {
        id: 456,
        customer: 'Jane Smith',
        address: '456 Oak Ave',
        items: [
          { quantity: 1, name: 'Burger', price: 9.99 },
          { quantity: 2, name: 'Fries', price: 3.50 }
        ],
        total: 16.99
      };

      const response = await request(app)
        .post('/api/print')
        .send(validOrder)
        .expect('Content-Type', /json/);

      // Should return 503 since no clients connected, but validation should pass
      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
    });

    it('should accept valid order data without optional address field', async () => {
      const validOrder = {
        id: 789,
        customer: 'Bob Johnson',
        items: [
          { quantity: 3, name: 'Tacos', price: 2.99 }
        ],
        total: 8.97
      };

      const response = await request(app)
        .post('/api/print')
        .send(validOrder)
        .expect('Content-Type', /json/);

      // Should return 503 since no clients connected, but validation should pass
      expect(response.status).toBe(503);
    });
  });

  describe('POST /api/print with invalid data', () => {
    it('should return 400 when id is missing', async () => {
      const invalidOrder = {
        customer: 'John Doe',
        items: [{ quantity: 1, name: 'Pizza', price: 10.00 }],
        total: 10.00
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when id is not positive', async () => {
      const invalidOrder = {
        id: 0,
        customer: 'John Doe',
        items: [{ quantity: 1, name: 'Pizza', price: 10.00 }],
        total: 10.00
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when customer is missing', async () => {
      const invalidOrder = {
        id: 123,
        items: [{ quantity: 1, name: 'Pizza', price: 10.00 }],
        total: 10.00
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when customer is empty string', async () => {
      const invalidOrder = {
        id: 123,
        customer: '',
        items: [{ quantity: 1, name: 'Pizza', price: 10.00 }],
        total: 10.00
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when items array is empty', async () => {
      const invalidOrder = {
        id: 123,
        customer: 'John Doe',
        items: [],
        total: 0
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when items array is missing', async () => {
      const invalidOrder = {
        id: 123,
        customer: 'John Doe',
        total: 10.00
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when item has invalid quantity', async () => {
      const invalidOrder = {
        id: 123,
        customer: 'John Doe',
        items: [{ quantity: 0, name: 'Pizza', price: 10.00 }],
        total: 10.00
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when item has empty name', async () => {
      const invalidOrder = {
        id: 123,
        customer: 'John Doe',
        items: [{ quantity: 1, name: '', price: 10.00 }],
        total: 10.00
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when item has negative price', async () => {
      const invalidOrder = {
        id: 123,
        customer: 'John Doe',
        items: [{ quantity: 1, name: 'Pizza', price: -5.00 }],
        total: -5.00
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when total is negative', async () => {
      const invalidOrder = {
        id: 123,
        customer: 'John Doe',
        items: [{ quantity: 1, name: 'Pizza', price: 10.00 }],
        total: -10.00
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when total is missing', async () => {
      const invalidOrder = {
        id: 123,
        customer: 'John Doe',
        items: [{ quantity: 1, name: 'Pizza', price: 10.00 }]
      };

      const response = await request(app)
        .post('/api/print')
        .send(invalidOrder)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/print')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      // Express will return 400 for malformed JSON
      expect(response.status).toBe(400);
    });
  });
});
