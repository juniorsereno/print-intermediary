/**
 * Unit tests for WebSocket Manager edge cases
 * Requirements: 9.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { WebSocketManager } from '../src/components/websocket.js';

describe('WebSocketManager Edge Cases', () => {
  let httpServer: HttpServer;
  let wsManager: WebSocketManager;

  beforeEach(() => {
    httpServer = createServer();
    wsManager = new WebSocketManager(httpServer);
    wsManager.initialize();
  });

  afterEach(() => {
    wsManager.close();
    httpServer.close();
  });

  describe('Zero Clients Scenario', () => {
    it('should return zero count when no clients are connected', () => {
      const count = wsManager.getClientCount();
      expect(count).toBe(0);
    });

    it('should return empty array when no clients are connected', () => {
      const clients = wsManager.getConnectedClients();
      expect(clients).toEqual([]);
    });

    it('should fail broadcast when no clients are connected', () => {
      const result = wsManager.broadcast('test data');
      
      expect(result.success).toBe(false);
      expect(result.clientCount).toBe(0);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('No clients connected');
    });

    it('should handle multiple broadcast attempts with zero clients', () => {
      const result1 = wsManager.broadcast('data 1');
      const result2 = wsManager.broadcast('data 2');
      const result3 = wsManager.broadcast('data 3');
      
      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
      
      expect(result1.clientCount).toBe(0);
      expect(result2.clientCount).toBe(0);
      expect(result3.clientCount).toBe(0);
    });
  });

  describe('Broadcast Data Edge Cases', () => {
    it('should handle empty string broadcast', () => {
      const result = wsManager.broadcast('');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('clientCount');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle very long data strings', () => {
      const longData = 'x'.repeat(1000000); // 1MB of data
      const result = wsManager.broadcast(longData);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('clientCount');
    });

    it('should handle JSON data', () => {
      const jsonData = JSON.stringify({
        id: 123,
        customer: 'Test',
        items: [{ name: 'Item', price: 10 }]
      });
      
      const result = wsManager.broadcast(jsonData);
      expect(result).toHaveProperty('success');
    });

    it('should handle base64 encoded data', () => {
      const base64Data = Buffer.from('test data').toString('base64');
      const dataUrl = `data:text/json;charset=utf-8,${base64Data}`;
      
      const result = wsManager.broadcast(dataUrl);
      expect(result).toHaveProperty('success');
    });

    it('should handle special characters', () => {
      const specialData = 'Test with émojis 🎉 and spëcial çhars';
      const result = wsManager.broadcast(specialData);
      
      expect(result).toHaveProperty('success');
    });

    it('should handle newlines and tabs', () => {
      const multilineData = 'Line 1\nLine 2\tTabbed\rCarriage return';
      const result = wsManager.broadcast(multilineData);
      
      expect(result).toHaveProperty('success');
    });

    it('should handle unicode characters', () => {
      const unicodeData = '中文字符 العربية עברית';
      const result = wsManager.broadcast(unicodeData);
      
      expect(result).toHaveProperty('success');
    });
  });

  describe('Client Information Consistency', () => {
    it('should maintain consistency between count and array length', () => {
      const count = wsManager.getClientCount();
      const clients = wsManager.getConnectedClients();
      
      expect(clients.length).toBe(count);
    });

    it('should return new array instance each time', () => {
      const clients1 = wsManager.getConnectedClients();
      const clients2 = wsManager.getConnectedClients();
      
      // Should be different array instances
      expect(clients1).not.toBe(clients2);
      // But with same content
      expect(clients1).toEqual(clients2);
    });

    it('should not allow external modification of client list', () => {
      const clients = wsManager.getConnectedClients();
      const originalLength = clients.length;
      
      // Try to modify the returned array
      clients.push({
        id: 'fake-id',
        connectedAt: new Date(),
        socketId: 'fake-socket'
      });
      
      // Should not affect the manager's internal state
      const newClients = wsManager.getConnectedClients();
      expect(newClients.length).toBe(originalLength);
    });
  });

  describe('Manager Lifecycle', () => {
    it('should initialize without errors', () => {
      const newServer = createServer();
      const newManager = new WebSocketManager(newServer);
      
      expect(() => newManager.initialize()).not.toThrow();
      
      newManager.close();
      newServer.close();
    });

    it('should close without errors', () => {
      expect(() => wsManager.close()).not.toThrow();
    });

    it('should handle operations after close', () => {
      wsManager.close();
      
      // Should still return valid results
      const count = wsManager.getClientCount();
      expect(count).toBe(0);
      
      const clients = wsManager.getConnectedClients();
      expect(clients).toEqual([]);
    });

    it('should handle multiple close calls', () => {
      expect(() => {
        wsManager.close();
        wsManager.close();
        wsManager.close();
      }).not.toThrow();
    });
  });

  describe('Broadcast Result Structure', () => {
    it('should always return object with required fields', () => {
      const result = wsManager.broadcast('test');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('clientCount');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.clientCount).toBe('number');
    });

    it('should include error field when broadcast fails', () => {
      const result = wsManager.broadcast('test');
      
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error!.length).toBeGreaterThan(0);
      }
    });

    it('should not include error field when broadcast succeeds', () => {
      // This test documents expected behavior when clients are connected
      // Currently with 0 clients, broadcast fails
      const result = wsManager.broadcast('test');
      
      if (result.success) {
        expect(result.error).toBeUndefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple getClientCount calls', () => {
      const count1 = wsManager.getClientCount();
      const count2 = wsManager.getClientCount();
      const count3 = wsManager.getClientCount();
      
      expect(count1).toBe(count2);
      expect(count2).toBe(count3);
    });

    it('should handle multiple getConnectedClients calls', () => {
      const clients1 = wsManager.getConnectedClients();
      const clients2 = wsManager.getConnectedClients();
      
      expect(clients1).toEqual(clients2);
    });

    it('should handle interleaved operations', () => {
      const count1 = wsManager.getClientCount();
      const clients1 = wsManager.getConnectedClients();
      const broadcast1 = wsManager.broadcast('test1');
      const count2 = wsManager.getClientCount();
      const clients2 = wsManager.getConnectedClients();
      const broadcast2 = wsManager.broadcast('test2');
      
      expect(count1).toBe(count2);
      expect(clients1).toEqual(clients2);
      expect(broadcast1.clientCount).toBe(broadcast2.clientCount);
    });
  });
});
