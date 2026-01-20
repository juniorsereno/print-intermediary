/**
 * Property-based tests for data validation
 * Feature: mcp-thermal-print-server, Property 4: Order Data Field Validation
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { OrderDataSchema, OrderItemSchema } from '../src/types/schemas.js';

describe('Property 4: Order Data Field Validation', () => {
  it('should reject OrderData with non-positive id', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.oneof(
            fc.integer({ max: 0 }),
            fc.double({ max: 0, noNaN: true }).filter(n => isFinite(n))
          ),
          customer: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          items: fc.array(fc.record({
            quantity: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            price: fc.double({ min: 0, noNaN: true }).filter(n => isFinite(n))
          }), { minLength: 1 }),
          total: fc.double({ min: 0, noNaN: true }).filter(n => isFinite(n))
        }),
        (invalidData) => {
          const result = OrderDataSchema.safeParse(invalidData);
          expect(result.success).toBe(false);
          if (!result.success) {
            const errorMessage = result.error.issues[0].message;
            expect(errorMessage).toMatch(/Order ID must be/i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject OrderData with empty customer name', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1 }),
          customer: fc.oneof(fc.constant(''), fc.constant('   ')),
          items: fc.array(fc.record({
            quantity: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            price: fc.double({ min: 0, noNaN: true }).filter(n => isFinite(n))
          }), { minLength: 1 }),
          total: fc.double({ min: 0, noNaN: true }).filter(n => isFinite(n))
        }),
        (invalidData) => {
          const result = OrderDataSchema.safeParse(invalidData);
          expect(result.success).toBe(false);
          if (!result.success) {
            const errorMessage = result.error.issues[0].message;
            expect(errorMessage).toMatch(/Customer name cannot be empty/i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject OrderData with empty items array', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1 }),
          customer: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          items: fc.constant([]),
          total: fc.double({ min: 0, noNaN: true }).filter(n => isFinite(n))
        }),
        (invalidData) => {
          const result = OrderDataSchema.safeParse(invalidData);
          expect(result.success).toBe(false);
          if (!result.success) {
            const errorMessage = result.error.issues[0].message;
            expect(errorMessage).toMatch(/Order must contain at least one item/i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject OrderItem with non-positive quantity', () => {
    fc.assert(
      fc.property(
        fc.record({
          quantity: fc.oneof(
            fc.integer({ max: 0 }),
            fc.double({ max: 0, noNaN: true }).filter(n => isFinite(n))
          ),
          name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          price: fc.double({ min: 0, noNaN: true }).filter(n => isFinite(n))
        }),
        (invalidItem) => {
          const result = OrderItemSchema.safeParse(invalidItem);
          expect(result.success).toBe(false);
          if (!result.success) {
            const errorMessage = result.error.issues[0].message;
            expect(errorMessage).toMatch(/quantity must be/i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject OrderItem with empty name', () => {
    fc.assert(
      fc.property(
        fc.record({
          quantity: fc.integer({ min: 1 }),
          name: fc.oneof(fc.constant(''), fc.constant('   ')),
          price: fc.double({ min: 0, noNaN: true }).filter(n => isFinite(n))
        }),
        (invalidItem) => {
          const result = OrderItemSchema.safeParse(invalidItem);
          expect(result.success).toBe(false);
          if (!result.success) {
            const errorMessage = result.error.issues[0].message;
            expect(errorMessage).toMatch(/Item name cannot be empty/i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject OrderItem with negative price', () => {
    fc.assert(
      fc.property(
        fc.record({
          quantity: fc.integer({ min: 1 }),
          name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          price: fc.double({ max: -0.01, noNaN: true }).filter(n => isFinite(n))
        }),
        (invalidItem) => {
          const result = OrderItemSchema.safeParse(invalidItem);
          expect(result.success).toBe(false);
          if (!result.success) {
            const errorMessage = result.error.issues[0].message;
            expect(errorMessage).toMatch(/price must be non-negative/i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject OrderData with negative total', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1 }),
          customer: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          items: fc.array(fc.record({
            quantity: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            price: fc.double({ min: 0, noNaN: true }).filter(n => isFinite(n))
          }), { minLength: 1 }),
          total: fc.double({ max: -0.01, noNaN: true }).filter(n => isFinite(n))
        }),
        (invalidData) => {
          const result = OrderDataSchema.safeParse(invalidData);
          expect(result.success).toBe(false);
          if (!result.success) {
            const errorMessage = result.error.issues[0].message;
            expect(errorMessage).toMatch(/total must be non-negative/i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept valid OrderData', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1 }),
          customer: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          address: fc.option(fc.string()),
          items: fc.array(fc.record({
            quantity: fc.integer({ min: 1 }),
            name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            price: fc.double({ min: 0, noNaN: true }).filter(n => isFinite(n))
          }), { minLength: 1 }),
          total: fc.double({ min: 0, noNaN: true }).filter(n => isFinite(n))
        }),
        (validData) => {
          const result = OrderDataSchema.safeParse(validData);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
