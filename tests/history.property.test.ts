/**
 * Property-based tests for Print History
 * Feature: mcp-thermal-print-server
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PrintHistory } from '../src/components/history.js';

// Arbitrary for generating print job data
const printJobArbitrary = () => fc.record({
  orderId: fc.integer({ min: 1, max: 999999 }),
  customer: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  total: fc.double({ min: 0, max: 10000, noNaN: true }).filter(n => isFinite(n)),
  status: fc.constantFrom('sent' as const, 'failed' as const),
  clientCount: fc.integer({ min: 0, max: 100 })
});

describe('Property 12: Print History Limit Enforcement', () => {
  /**
   * Feature: mcp-thermal-print-server, Property 12: Print History Limit Enforcement
   * Validates: Requirements 5.3
   */
  it('should return at most L jobs when requesting L jobs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.array(printJobArbitrary(), { minLength: 0, maxLength: 200 }),
        (limit, jobsData) => {
          const history = new PrintHistory(1000);
          
          // Add all jobs
          jobsData.forEach(jobData => history.add(jobData));
          
          // Request L jobs
          const retrieved = history.getRecent(limit);
          
          // Should return at most L jobs
          expect(retrieved.length).toBeLessThanOrEqual(limit);
          
          // Should return exactly min(L, total_jobs)
          const expectedCount = Math.min(limit, jobsData.length);
          expect(retrieved.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never return more jobs than requested', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 10, max: 100 }),
        (requestedLimit, jobCount) => {
          const history = new PrintHistory(1000);
          
          // Add jobCount jobs
          for (let i = 0; i < jobCount; i++) {
            history.add({
              orderId: i,
              customer: `Customer ${i}`,
              total: 10.0,
              status: 'sent',
              clientCount: 1
            });
          }
          
          // Request requestedLimit jobs
          const retrieved = history.getRecent(requestedLimit);
          
          // Should never exceed requested limit
          expect(retrieved.length).toBeLessThanOrEqual(requestedLimit);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 13: Print History Entry Completeness', () => {
  /**
   * Feature: mcp-thermal-print-server, Property 13: Print History Entry Completeness
   * Validates: Requirements 5.4
   */
  it('should include all required fields in every entry', () => {
    fc.assert(
      fc.property(
        fc.array(printJobArbitrary(), { minLength: 1, maxLength: 50 }),
        (jobsData) => {
          const history = new PrintHistory(1000);
          
          // Add all jobs
          jobsData.forEach(jobData => history.add(jobData));
          
          // Retrieve all jobs
          const retrieved = history.getRecent(jobsData.length);
          
          // Every entry should have all required fields
          retrieved.forEach(job => {
            expect(job).toHaveProperty('id');
            expect(job).toHaveProperty('orderId');
            expect(job).toHaveProperty('customer');
            expect(job).toHaveProperty('total');
            expect(job).toHaveProperty('timestamp');
            expect(job).toHaveProperty('status');
            expect(job).toHaveProperty('clientCount');
            
            // Verify types
            expect(typeof job.id).toBe('string');
            expect(job.id.length).toBeGreaterThan(0);
            expect(typeof job.orderId).toBe('number');
            expect(typeof job.customer).toBe('string');
            expect(typeof job.total).toBe('number');
            expect(job.timestamp).toBeInstanceOf(Date);
            expect(['sent', 'failed']).toContain(job.status);
            expect(typeof job.clientCount).toBe('number');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should auto-generate id and timestamp for each entry', () => {
    fc.assert(
      fc.property(
        printJobArbitrary(),
        (jobData) => {
          const history = new PrintHistory(1000);
          
          // Add job without id and timestamp
          const addedJob = history.add(jobData);
          
          // Should have auto-generated id (UUID format)
          expect(addedJob.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
          
          // Should have auto-generated timestamp
          expect(addedJob.timestamp).toBeInstanceOf(Date);
          
          // Timestamp should be recent (within last second)
          const now = new Date();
          const timeDiff = now.getTime() - addedJob.timestamp.getTime();
          expect(timeDiff).toBeLessThan(1000);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 14: Print History Circular Buffer Size', () => {
  /**
   * Feature: mcp-thermal-print-server, Property 14: Print History Circular Buffer Size
   * Validates: Requirements 5.5
   */
  it('should never exceed 1000 entries when maxSize is 1000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1001, max: 2000 }),
        (jobCount) => {
          const history = new PrintHistory(1000);
          
          // Add more than 1000 jobs
          for (let i = 0; i < jobCount; i++) {
            history.add({
              orderId: i,
              customer: `Customer ${i}`,
              total: 10.0,
              status: 'sent',
              clientCount: 1
            });
          }
          
          // Should never exceed 1000
          expect(history.getCount()).toBeLessThanOrEqual(1000);
          expect(history.getCount()).toBe(1000);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain circular buffer behavior with any maxSize', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 100 }),
        fc.integer({ min: 1, max: 200 }),
        (maxSize, jobCount) => {
          const history = new PrintHistory(maxSize);
          
          // Add jobCount jobs
          for (let i = 0; i < jobCount; i++) {
            history.add({
              orderId: i,
              customer: `Customer ${i}`,
              total: 10.0,
              status: 'sent',
              clientCount: 1
            });
          }
          
          // Should never exceed maxSize
          expect(history.getCount()).toBeLessThanOrEqual(maxSize);
          
          // Should be exactly min(jobCount, maxSize)
          const expectedCount = Math.min(jobCount, maxSize);
          expect(history.getCount()).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should keep most recent jobs when buffer is full', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 50 }),
        (maxSize) => {
          const history = new PrintHistory(maxSize);
          
          // Add more jobs than maxSize
          const totalJobs = maxSize + 10;
          for (let i = 0; i < totalJobs; i++) {
            history.add({
              orderId: i,
              customer: `Customer ${i}`,
              total: 10.0,
              status: 'sent',
              clientCount: 1
            });
          }
          
          // Get all jobs
          const retrieved = history.getRecent(maxSize);
          
          // Should have the most recent jobs (highest orderIds)
          const firstOrderId = retrieved[0].orderId;
          const lastOrderId = retrieved[retrieved.length - 1].orderId;
          
          // First retrieved should be the most recent (highest orderId)
          expect(firstOrderId).toBe(totalJobs - 1);
          
          // Last retrieved should be the oldest kept (totalJobs - maxSize)
          expect(lastOrderId).toBe(totalJobs - maxSize);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Print History Additional Properties', () => {
  it('should return jobs in reverse chronological order (newest first)', () => {
    fc.assert(
      fc.property(
        fc.array(printJobArbitrary(), { minLength: 2, maxLength: 50 }),
        (jobsData) => {
          const history = new PrintHistory(1000);
          
          // Add jobs with small delays to ensure different timestamps
          const addedJobs = jobsData.map(jobData => history.add(jobData));
          
          // Retrieve all jobs
          const retrieved = history.getRecent(jobsData.length);
          
          // Should be in reverse order (newest first)
          for (let i = 0; i < retrieved.length - 1; i++) {
            expect(retrieved[i].timestamp.getTime()).toBeGreaterThanOrEqual(
              retrieved[i + 1].timestamp.getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate unique IDs for each job', () => {
    fc.assert(
      fc.property(
        fc.array(printJobArbitrary(), { minLength: 2, maxLength: 100 }),
        (jobsData) => {
          const history = new PrintHistory(1000);
          
          // Add all jobs
          jobsData.forEach(jobData => history.add(jobData));
          
          // Retrieve all jobs
          const retrieved = history.getRecent(jobsData.length);
          
          // All IDs should be unique
          const ids = retrieved.map(job => job.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
