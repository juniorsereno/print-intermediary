/**
 * Data Validator Component
 * Validates input data using Zod schemas
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.2
 */

import { ZodError } from 'zod';
import { OrderDataSchema, HistoryLimitSchema } from '../types/schemas.js';
import type { OrderData } from '../types/models.js';
import { Logger } from '../utils/logger.js';

/**
 * Result of a validation operation
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  success: boolean;
  /** Validated data (only present if success is true) */
  data?: T;
  /** Error message (only present if success is false) */
  error?: string;
  /** Field that failed validation (only present if success is false) */
  field?: string;
}

/**
 * DataValidator class
 * Provides methods for validating order data and history limits
 */
export class DataValidator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('DataValidator');
  }

  /**
   * Validates order data against the OrderDataSchema
   * @param data - Unknown data to validate
   * @returns ValidationResult with success status and data or error
   * 
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 7.2
   */
  validateOrderData(data: unknown): ValidationResult<OrderData> {
    try {
      const validatedData = OrderDataSchema.parse(data);
      this.logger.info('Order data validated successfully', { orderId: validatedData.id });
      return {
        success: true,
        data: validatedData
      };
    } catch (error) {
      if (error instanceof ZodError) {
        // Extract the first error for a clear message
        const firstIssue = error.issues[0];
        const field = firstIssue.path.join('.');
        const message = firstIssue.message;
        
        this.logger.warn('Order data validation failed', { 
          field, 
          message,
          path: firstIssue.path 
        });
        
        return {
          success: false,
          error: message,
          field: field || 'unknown'
        };
      }
      
      // Handle unexpected errors
      this.logger.error('Unexpected error during order data validation', error);
      return {
        success: false,
        error: 'Validation failed due to an unexpected error',
        field: 'unknown'
      };
    }
  }

  /**
   * Validates history limit parameter
   * @param limit - Unknown limit value to validate
   * @returns ValidationResult with success status and validated limit or error
   * 
   * Requirements: 5.3, 7.2
   */
  validateHistoryLimit(limit: unknown): ValidationResult<number> {
    try {
      const validatedLimit = HistoryLimitSchema.parse(limit);
      this.logger.debug('History limit validated', { limit: validatedLimit });
      return {
        success: true,
        data: validatedLimit
      };
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues[0];
        const message = firstIssue.message;
        
        this.logger.warn('History limit validation failed', { 
          message,
          providedValue: limit 
        });
        
        return {
          success: false,
          error: message,
          field: 'limit'
        };
      }
      
      this.logger.error('Unexpected error during history limit validation', error);
      return {
        success: false,
        error: 'Validation failed for history limit',
        field: 'limit'
      };
    }
  }
}
