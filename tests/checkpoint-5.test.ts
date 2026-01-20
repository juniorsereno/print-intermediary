/**
 * Checkpoint 5: Integration test for validation and formatting
 * Verifies that validation rejects invalid data and formatting produces valid Saiposprt
 */

import { describe, it, expect } from 'vitest';
import { DataValidator } from '../src/components/validator.js';
import { SaiposFormatter } from '../src/components/formatter.js';

describe('Checkpoint 5: Validation and Formatting Integration', () => {
  const validator = new DataValidator();
  const formatter = new SaiposFormatter({ idStore: 12345, idUser: 67890 });

  it('should reject invalid data correctly', () => {
    // Test various invalid data scenarios
    const invalidCases = [
      {
        name: 'missing id',
        data: { customer: 'John', items: [{ quantity: 1, name: 'Item', price: 10 }], total: 10 }
      },
      {
        name: 'empty customer',
        data: { id: 1, customer: '', items: [{ quantity: 1, name: 'Item', price: 10 }], total: 10 }
      },
      {
        name: 'empty items',
        data: { id: 1, customer: 'John', items: [], total: 0 }
      },
      {
        name: 'negative total',
        data: { id: 1, customer: 'John', items: [{ quantity: 1, name: 'Item', price: 10 }], total: -10 }
      },
      {
        name: 'zero id',
        data: { id: 0, customer: 'John', items: [{ quantity: 1, name: 'Item', price: 10 }], total: 10 }
      }
    ];

    for (const testCase of invalidCases) {
      const result = validator.validateOrderData(testCase.data);
      expect(result.success, `${testCase.name} should be rejected`).toBe(false);
      expect(result.error, `${testCase.name} should have error message`).toBeDefined();
    }
  });

  it('should accept valid data and produce valid Saiposprt format', () => {
    const validData = {
      id: 123,
      customer: 'John Doe',
      address: '123 Main St',
      items: [
        { quantity: 2, name: 'Pizza Margherita', price: 15.99 },
        { quantity: 1, name: 'Coca-Cola', price: 2.50 }
      ],
      total: 34.48
    };

    // Validate
    const validationResult = validator.validateOrderData(validData);
    expect(validationResult.success).toBe(true);
    expect(validationResult.data).toBeDefined();

    // Format
    if (validationResult.data) {
      const formatted = formatter.format(validationResult.data);
      
      // Verify format
      expect(formatted).toMatch(/^data:text\/json;charset=utf-8,/);
      
      // Decode and verify structure
      const base64Part = formatted.replace('data:text/json;charset=utf-8,', '');
      const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      
      const printData = parsed[0];
      expect(printData.id_sale).toBe(123);
      expect(printData.sale_number).toBe('do pedido 123');
      expect(printData.printSettings.fileName).toBe('123.saiposprt');
      
      // Verify customer name is in print rows
      const hasCustomer = printData.printRows.some((row: string) => row.includes('John Doe'));
      expect(hasCustomer).toBe(true);
      
      // Verify address is in print rows
      const hasAddress = printData.printRows.some((row: string) => row.includes('123 Main St'));
      expect(hasAddress).toBe(true);
    }
  });

  it('should handle data without optional address', () => {
    const validData = {
      id: 456,
      customer: 'Jane Smith',
      items: [
        { quantity: 1, name: 'Burger', price: 8.99 }
      ],
      total: 8.99
    };

    // Validate
    const validationResult = validator.validateOrderData(validData);
    expect(validationResult.success).toBe(true);

    // Format
    if (validationResult.data) {
      const formatted = formatter.format(validationResult.data);
      
      // Decode
      const base64Part = formatted.replace('data:text/json;charset=utf-8,', '');
      const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      const printData = parsed[0];
      
      // Verify it still works without address
      expect(printData.id_sale).toBe(456);
      
      const hasCustomer = printData.printRows.some((row: string) => row.includes('Jane Smith'));
      expect(hasCustomer).toBe(true);
    }
  });

  it('should handle multiple items correctly', () => {
    const validData = {
      id: 789,
      customer: 'Bob Johnson',
      items: [
        { quantity: 3, name: 'Taco', price: 3.50 },
        { quantity: 2, name: 'Burrito', price: 7.99 },
        { quantity: 1, name: 'Nachos', price: 5.50 }
      ],
      total: 26.98
    };

    // Validate
    const validationResult = validator.validateOrderData(validData);
    expect(validationResult.success).toBe(true);

    // Format
    if (validationResult.data) {
      const formatted = formatter.format(validationResult.data);
      
      // Decode
      const base64Part = formatted.replace('data:text/json;charset=utf-8,', '');
      const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      const printData = parsed[0];
      
      // Verify all items are present
      const hasTaco = printData.printRows.some((row: string) => row.includes('Taco'));
      const hasBurrito = printData.printRows.some((row: string) => row.includes('Burrito'));
      const hasNachos = printData.printRows.some((row: string) => row.includes('Nachos'));
      
      expect(hasTaco).toBe(true);
      expect(hasBurrito).toBe(true);
      expect(hasNachos).toBe(true);
      
      // Verify item count
      const itemCountRow = printData.printRows.find((row: string) => 
        row.includes('Quantidade de itens')
      );
      expect(itemCountRow).toBeDefined();
      expect(itemCountRow).toContain('3');
    }
  });

  it('should validate and format edge case: zero-price items', () => {
    const validData = {
      id: 999,
      customer: 'Test User',
      items: [
        { quantity: 1, name: 'Free Sample', price: 0 }
      ],
      total: 0
    };

    // Validate
    const validationResult = validator.validateOrderData(validData);
    expect(validationResult.success).toBe(true);

    // Format
    if (validationResult.data) {
      const formatted = formatter.format(validationResult.data);
      expect(formatted).toMatch(/^data:text\/json;charset=utf-8,/);
      
      // Decode and verify
      const base64Part = formatted.replace('data:text/json;charset=utf-8,', '');
      const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      
      expect(parsed[0].id_sale).toBe(999);
    }
  });
});
