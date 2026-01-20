/**
 * Zod schemas for data validation
 * These schemas validate input data according to requirements 3.1-3.6
 */
import { z } from 'zod';
/**
 * Schema for validating order items
 * Requirements: 3.4
 */
export const OrderItemSchema = z.object({
    quantity: z.number().positive({
        message: 'Item quantity must be a positive number'
    }).finite({
        message: 'Item quantity must be a finite number'
    }).describe('Quantity of the item'),
    name: z.string().trim().min(1, {
        message: 'Item name cannot be empty'
    }).describe('Name/description of the item'),
    price: z.number().nonnegative({
        message: 'Item price must be non-negative'
    }).finite({
        message: 'Item price must be a finite number'
    }).describe('Unit price of the item')
});
/**
 * Schema for validating order data
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export const OrderDataSchema = z.object({
    id: z.number().positive({
        message: 'Order ID must be a positive integer'
    }).int({
        message: 'Order ID must be an integer'
    }).describe('Unique order ID'),
    customer: z.string().trim().min(1, {
        message: 'Customer name cannot be empty'
    }).describe('Customer name'),
    address: z.string().optional().nullable().describe('Delivery address (optional)'),
    items: z.array(OrderItemSchema).min(1, {
        message: 'Order must contain at least one item'
    }).describe('List of items in the order'),
    total: z.number().nonnegative({
        message: 'Order total must be non-negative'
    }).finite({
        message: 'Order total must be a finite number'
    }).describe('Total order value')
});
/**
 * Schema for validating print history limit parameter
 */
export const HistoryLimitSchema = z.number()
    .int({ message: 'Limit must be an integer' })
    .positive({ message: 'Limit must be positive' })
    .max(1000, { message: 'Limit cannot exceed 1000' })
    .default(50);
