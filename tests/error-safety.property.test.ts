/**
 * Property-Based Tests for Error Response Safety
 * Feature: mcp-thermal-print-server, Property 20: Error Response Safety
 * Validates: Requirements 7.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import http from 'http';
import { DataValidator } from '../src/components/validator.js';
import { SaiposFormatter } from '../src/components/formatter.js';
import { WebSocketManager } from '../src/components/websocket.js';
import { PrintHistory } from '../src/components/history.js';
import { LegacyHttpHandler } from '../src/components/legacy.js';

describe('Property 20: Error Response Safety', () => {
  let httpServer: http.Server;
  let wsManager: WebSocketManager;
  let validator: DataValidator;
  let formatter: SaiposFormatter;
  let history: PrintHistory;
  let legacyHandler: LegacyHttpHandler;

  beforeEach(() => {
    httpServer = http.createServer();
    wsManager = new WebSocketManager(httpServer);
    wsManager.initialize();
    validator = new DataValidator();
    formatter = new SaiposFormatter({ idStore: 72144, idUser: 1 });
    history = new PrintHistory(1000);
    legacyHandler = new LegacyHttpHandler(validator, formatter, wsManager, history);
  });

  afterEach(() => {
    wsManager.close();
    httpServer.close();
  });

  // Feature: mcp-thermal-print-server, Property 20: Error Response Safety
  it('should not expose stack traces or internal details in validation errors', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant('not-a-number'),
            fc.integer({ max: 0 })
          ),
          customer: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant('')
          ),
          items: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant([])
          ),
          total: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant('not-a-number'),
            fc.double({ max: -0.01 })
          )
        }),
        (invalidData) => {
          const result = validator.validateOrderData(invalidData);
          
          // Should fail validation
          expect(result.success).toBe(false);
          
          // Error message should not contain stack traces
          if (result.error) {
            expect(result.error).not.toMatch(/at\s+\w+\s+\(/); // Stack trace pattern
            expect(result.error).not.toMatch(/\.ts:\d+:\d+/); // File location pattern
            expect(result.error).not.toContain('Error:');
            expect(result.error).not.toContain('TypeError:');
            expect(result.error).not.toContain('ReferenceError:');
          }
          
          // Should not expose internal implementation details
          if (result.error) {
            expect(result.error).not.toContain('ZodError');
            expect(result.error).not.toContain('parse');
            expect(result.error).not.toContain('validator.ts');
            expect(result.error).not.toContain('node_modules');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: mcp-thermal-print-server, Property 20: Error Response Safety
  it('should not expose internal details in formatter errors', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1 }),
          customer: fc.string({ minLength: 1 }),
          items: fc.array(
            fc.record({
              quantity: fc.integer({ min: 1 }),
              name: fc.string({ minLength: 1 }),
              price: fc.double({ min: 0, noNaN: true })
            }),
            { minLength: 1 }
          ),
          total: fc.double({ min: 0, noNaN: true })
        }),
        (orderData) => {
          try {
            // This should succeed, but we're testing error handling
            const result = formatter.format(orderData);
            expect(result).toBeDefined();
          } catch (error) {
            // If an error occurs, it should be safe
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Should not expose stack traces
            expect(errorMessage).not.toMatch(/at\s+\w+\s+\(/);
            expect(errorMessage).not.toMatch(/\.ts:\d+:\d+/);
            
            // Should not expose internal details
            expect(errorMessage).not.toContain('formatter.ts');
            expect(errorMessage).not.toContain('node_modules');
            expect(errorMessage).not.toContain('Buffer');
            expect(errorMessage).not.toContain('base64');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: mcp-thermal-print-server, Property 20: Error Response Safety
  it('should not expose sensitive configuration in error messages', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ max: 0 }),
          customer: fc.string(),
          items: fc.array(fc.anything()),
          total: fc.double()
        }),
        (invalidData) => {
          const result = validator.validateOrderData(invalidData);
          
          if (!result.success && result.error) {
            // Should not expose configuration values
            expect(result.error).not.toContain('72144'); // idStore
            expect(result.error).not.toContain('idUser');
            expect(result.error).not.toContain('idStore');
            expect(result.error).not.toContain('localhost');
            expect(result.error).not.toContain('3000');
            expect(result.error).not.toContain('3001');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
