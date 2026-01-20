/**
 * Unit tests for DataValidator component
 * Tests edge cases and specific validation scenarios
 * Requirements: 3.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataValidator } from '../src/components/validator.js';

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('validateOrderData', () => {
    it('should accept valid order data with all fields', () => {
      const validData = {
        id: 123,
        customer: 'John Doe',
        address: '123 Main St',
        items: [
          { quantity: 2, name: 'Pizza', price: 15.99 },
          { quantity: 1, name: 'Soda', price: 2.50 }
        ],
        total: 34.48
      };

      const result = validator.validateOrderData(validData);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid order data without optional address', () => {
      const validData = {
        id: 456,
        customer: 'Jane Smith',
        items: [
          { quantity: 1, name: 'Burger', price: 8.99 }
        ],
        total: 8.99
      };

      const result = validator.validateOrderData(validData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should accept order data with address as null', () => {
      const validData = {
        id: 789,
        customer: 'Bob Johnson',
        address: null,
        items: [
          { quantity: 3, name: 'Taco', price: 3.50 }
        ],
        total: 10.50
      };

      const result = validator.validateOrderData(validData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject order with missing id field', () => {
      const invalidData = {
        customer: 'Test Customer',
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.field).toBe('id');
    });

    it('should reject order with missing customer field', () => {
      const invalidData = {
        id: 1,
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.field).toBe('customer');
    });

    it('should reject order with missing items field', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.field).toBe('items');
    });

    it('should reject order with missing total field', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        items: [{ quantity: 1, name: 'Item', price: 10 }]
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.field).toBe('total');
    });

    it('should reject order with id as zero', () => {
      const invalidData = {
        id: 0,
        customer: 'Test Customer',
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Order ID must be/i);
      expect(result.field).toBe('id');
    });

    it('should reject order with negative id', () => {
      const invalidData = {
        id: -5,
        customer: 'Test Customer',
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Order ID must be/i);
    });

    it('should reject order with non-integer id', () => {
      const invalidData = {
        id: 1.5,
        customer: 'Test Customer',
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Order ID must be/i);
    });

    it('should reject order with empty customer name', () => {
      const invalidData = {
        id: 1,
        customer: '',
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Customer name cannot be empty/i);
      expect(result.field).toBe('customer');
    });

    it('should reject order with whitespace-only customer name', () => {
      const invalidData = {
        id: 1,
        customer: '   ',
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Customer name cannot be empty/i);
    });

    it('should reject order with empty items array', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        items: [],
        total: 0
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Order must contain at least one item/i);
      expect(result.field).toBe('items');
    });

    it('should reject order with item missing quantity', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        items: [{ name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.field).toMatch(/items/);
    });

    it('should reject order with item having zero quantity', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        items: [{ quantity: 0, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/quantity must be/i);
    });

    it('should reject order with item having negative quantity', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        items: [{ quantity: -2, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/quantity must be/i);
    });

    it('should reject order with item having empty name', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        items: [{ quantity: 1, name: '', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Item name cannot be empty/i);
    });

    it('should reject order with item having negative price', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        items: [{ quantity: 1, name: 'Item', price: -5 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/price must be non-negative/i);
    });

    it('should reject order with negative total', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: -10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/total must be non-negative/i);
      expect(result.field).toBe('total');
    });

    it('should accept order with zero total', () => {
      const validData = {
        id: 1,
        customer: 'Test Customer',
        items: [{ quantity: 1, name: 'Free Item', price: 0 }],
        total: 0
      };

      const result = validator.validateOrderData(validData);
      
      expect(result.success).toBe(true);
    });

    it('should reject order with wrong type for id', () => {
      const invalidData = {
        id: 'not-a-number',
        customer: 'Test Customer',
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.field).toBe('id');
    });

    it('should reject order with wrong type for customer', () => {
      const invalidData = {
        id: 1,
        customer: 123,
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.field).toBe('customer');
    });

    it('should reject order with wrong type for items', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        items: 'not-an-array',
        total: 10
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.field).toBe('items');
    });

    it('should reject order with wrong type for total', () => {
      const invalidData = {
        id: 1,
        customer: 'Test Customer',
        items: [{ quantity: 1, name: 'Item', price: 10 }],
        total: 'not-a-number'
      };

      const result = validator.validateOrderData(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.field).toBe('total');
    });
  });

  describe('validateHistoryLimit', () => {
    it('should accept valid limit within range', () => {
      const result = validator.validateHistoryLimit(50);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(50);
    });

    it('should accept limit of 1', () => {
      const result = validator.validateHistoryLimit(1);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(1);
    });

    it('should accept limit of 1000 (maximum)', () => {
      const result = validator.validateHistoryLimit(1000);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(1000);
    });

    it('should use default value of 50 for undefined', () => {
      const result = validator.validateHistoryLimit(undefined);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(50);
    });

    it('should reject limit of 0', () => {
      const result = validator.validateHistoryLimit(0);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Limit must be positive/i);
      expect(result.field).toBe('limit');
    });

    it('should reject negative limit', () => {
      const result = validator.validateHistoryLimit(-10);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Limit must be positive/i);
    });

    it('should reject limit exceeding 1000', () => {
      const result = validator.validateHistoryLimit(1001);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Limit cannot exceed 1000/i);
    });

    it('should reject non-integer limit', () => {
      const result = validator.validateHistoryLimit(50.5);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Limit must be an integer/i);
    });

    it('should reject non-numeric limit', () => {
      const result = validator.validateHistoryLimit('not-a-number');
      
      expect(result.success).toBe(false);
      expect(result.field).toBe('limit');
    });
  });
});
