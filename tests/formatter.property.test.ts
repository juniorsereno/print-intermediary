/**
 * Property-based tests for Saiposprt Formatter
 * Feature: mcp-thermal-print-server
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SaiposFormatter } from '../src/components/formatter.js';
import type { OrderData } from '../src/types/models.js';

// Arbitrary for generating valid OrderData
const validOrderDataArbitrary = () => fc.record({
  id: fc.integer({ min: 1, max: 999999999 }),
  customer: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  address: fc.option(fc.string({ maxLength: 100 })),
  items: fc.array(fc.record({
    quantity: fc.integer({ min: 1, max: 100 }),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    price: fc.double({ min: 0, max: 10000, noNaN: true }).filter(n => isFinite(n))
  }), { minLength: 1, maxLength: 20 }),
  total: fc.double({ min: 0, max: 100000, noNaN: true }).filter(n => isFinite(n))
});

describe('Property 5: Valid Order Data Formatting', () => {
  /**
   * Feature: mcp-thermal-print-server, Property 5: Valid Order Data Formatting
   * Validates: Requirements 2.3, 8.3
   */
  it('should produce valid Saiposprt format for any valid OrderData', () => {
    const formatter = new SaiposFormatter({ idStore: 12345, idUser: 67890 });

    fc.assert(
      fc.property(
        validOrderDataArbitrary(),
        (orderData) => {
          const result = formatter.format(orderData as OrderData);
          
          // Verify it's a data URL
          expect(result).toMatch(/^data:text\/json;charset=utf-8,/);
          
          // Extract base64 part
          const base64Part = result.replace('data:text/json;charset=utf-8,', '');
          
          // Verify base64 can be decoded
          expect(() => {
            Buffer.from(base64Part, 'base64').toString('utf-8');
          }).not.toThrow();
          
          // Decode and parse JSON
          const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          
          // Verify it's an array with one element
          expect(Array.isArray(parsed)).toBe(true);
          expect(parsed.length).toBe(1);
          
          // Verify structure
          const printData = parsed[0];
          expect(printData).toHaveProperty('printSettings');
          expect(printData).toHaveProperty('printRows');
          expect(printData).toHaveProperty('sale_number');
          expect(printData).toHaveProperty('id_sale');
          expect(printData).toHaveProperty('logData');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 6: Saiposprt Format Round Trip', () => {
  /**
   * Feature: mcp-thermal-print-server, Property 6: Saiposprt Format Round Trip
   * Validates: Requirements 8.1, 8.2, 8.4, 8.5
   */
  it('should preserve original order data after format and decode', () => {
    const formatter = new SaiposFormatter({ idStore: 12345, idUser: 67890 });

    fc.assert(
      fc.property(
        validOrderDataArbitrary(),
        (orderData) => {
          const result = formatter.format(orderData as OrderData);
          
          // Decode
          const base64Part = result.replace('data:text/json;charset=utf-8,', '');
          const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          const printData = parsed[0];
          
          // Verify original data is preserved
          expect(printData.id_sale).toBe(orderData.id);
          expect(printData.sale_number).toBe(`do pedido ${orderData.id}`);
          
          // Verify print rows contain customer name
          const customerRow = printData.printRows.find((row: string) => 
            row.includes(orderData.customer)
          );
          expect(customerRow).toBeDefined();
          
          // Verify print rows contain order ID
          const orderIdRow = printData.printRows.find((row: string) => 
            row.includes(`ID do pedido: ${orderData.id}`)
          );
          expect(orderIdRow).toBeDefined();
          
          // Verify items count
          const itemsCountRow = printData.printRows.find((row: string) => 
            row.includes('Quantidade de itens')
          );
          expect(itemsCountRow).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 7: Saiposprt Filename Generation', () => {
  /**
   * Feature: mcp-thermal-print-server, Property 7: Saiposprt Filename Generation
   * Validates: Requirements 8.6
   */
  it('should generate filename in format "orderId.saiposprt"', () => {
    const formatter = new SaiposFormatter({ idStore: 12345, idUser: 67890 });

    fc.assert(
      fc.property(
        validOrderDataArbitrary(),
        (orderData) => {
          const result = formatter.format(orderData as OrderData);
          
          // Decode
          const base64Part = result.replace('data:text/json;charset=utf-8,', '');
          const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          const printData = parsed[0];
          
          // Verify filename format
          expect(printData.printSettings.fileName).toBe(`${orderData.id}.saiposprt`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 16: Saiposprt Format Structure Consistency', () => {
  /**
   * Feature: mcp-thermal-print-server, Property 16: Saiposprt Format Structure Consistency
   * Validates: Requirements 6.4
   */
  it('should always include required fields in Saiposprt structure', () => {
    const formatter = new SaiposFormatter({ idStore: 12345, idUser: 67890 });

    fc.assert(
      fc.property(
        validOrderDataArbitrary(),
        (orderData) => {
          const result = formatter.format(orderData as OrderData);
          
          // Decode
          const base64Part = result.replace('data:text/json;charset=utf-8,', '');
          const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          const printData = parsed[0];
          
          // Verify all required fields exist
          expect(printData.printSettings).toBeDefined();
          expect(printData.printRows).toBeDefined();
          expect(printData.sale_number).toBeDefined();
          expect(printData.id_sale).toBeDefined();
          expect(printData.logData).toBeDefined();
          
          // Verify printSettings structure
          expect(printData.printSettings.type).toBeDefined();
          expect(printData.printSettings.layout).toBeDefined();
          expect(printData.printSettings.rowColumns).toBeDefined();
          expect(printData.printSettings.fontSize).toBeDefined();
          expect(printData.printSettings.copies).toBeDefined();
          expect(printData.printSettings.idStore).toBeDefined();
          expect(printData.printSettings.id_user).toBeDefined();
          expect(printData.printSettings.fileName).toBeDefined();
          
          // Verify logData structure
          expect(printData.logData.id_store).toBeDefined();
          expect(printData.logData.id_sale).toBeDefined();
          expect(printData.logData.print_sent_user).toBeDefined();
          expect(printData.logData.print_sent_method).toBeDefined();
          expect(printData.logData.print_auto).toBeDefined();
          
          // Verify printRows is an array
          expect(Array.isArray(printData.printRows)).toBe(true);
          expect(printData.printRows.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
