/**
 * Data Validator Component
 * Validates input data using Zod schemas
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
import { ZodError } from 'zod';
import { OrderDataSchema, HistoryLimitSchema } from '../types/schemas.js';
/**
 * DataValidator class
 * Provides methods for validating order data and history limits
 */
export class DataValidator {
    /**
     * Validates order data against the OrderDataSchema
     * @param data - Unknown data to validate
     * @returns ValidationResult with success status and data or error
     *
     * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
     */
    validateOrderData(data) {
        try {
            const validatedData = OrderDataSchema.parse(data);
            return {
                success: true,
                data: validatedData
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                // Extract the first error for a clear message
                const firstIssue = error.issues[0];
                const field = firstIssue.path.join('.');
                const message = firstIssue.message;
                return {
                    success: false,
                    error: message,
                    field: field || 'unknown'
                };
            }
            // Handle unexpected errors
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
     * Requirements: 5.3
     */
    validateHistoryLimit(limit) {
        try {
            const validatedLimit = HistoryLimitSchema.parse(limit);
            return {
                success: true,
                data: validatedLimit
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                const firstIssue = error.issues[0];
                const message = firstIssue.message;
                return {
                    success: false,
                    error: message,
                    field: 'limit'
                };
            }
            return {
                success: false,
                error: 'Validation failed for history limit',
                field: 'limit'
            };
        }
    }
}
