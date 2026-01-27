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
 * Schema for validating order data (input from API/LLM)
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export const OrderDataInputSchema = z.object({
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
  
  deliveryFee: z.number().nonnegative({
    message: 'Delivery fee must be non-negative'
  }).finite({
    message: 'Delivery fee must be a finite number'
  }).optional().default(0).describe('Delivery/shipping fee (optional, defaults to 0)'),
  
  // Total is optional in input - will be calculated automatically
  total: z.number().nonnegative({
    message: 'Order total must be non-negative'
  }).finite({
    message: 'Order total must be a finite number'
  }).optional().describe('Total order value (optional - will be calculated automatically)')
}).transform((data) => {
  // Calculate total automatically: sum of (quantity * price) + deliveryFee
  const itemsTotal = data.items.reduce((sum, item) => {
    return sum + (item.quantity * item.price);
  }, 0);
  
  const calculatedTotal = itemsTotal + (data.deliveryFee || 0);
  
  // Return data with calculated total
  return {
    ...data,
    total: calculatedTotal,
    deliveryFee: data.deliveryFee || 0
  };
});

/**
 * Schema for backward compatibility (accepts the old format)
 * This is the validated output schema after transformation
 */
export const OrderDataSchema = OrderDataInputSchema;

/**
 * Type inference from Zod schemas
 * These ensure TypeScript types match Zod validation
 */
export type OrderDataInput = z.infer<typeof OrderDataSchema>;
export type OrderItemInput = z.infer<typeof OrderItemSchema>;

/**
 * Schema for validating print history limit parameter
 */
export const HistoryLimitSchema = z.number()
  .int({ message: 'Limit must be an integer' })
  .positive({ message: 'Limit must be positive' })
  .max(1000, { message: 'Limit cannot exceed 1000' })
  .default(50);
