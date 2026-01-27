/**
 * Data models for MCP Thermal Print Server
 * These types define the core data structures used throughout the application
 */

/**
 * Represents a single item in an order
 */
export interface OrderItem {
  /** Quantity of the item (must be positive) */
  quantity: number;
  /** Name/description of the item */
  name: string;
  /** Unit price of the item (must be non-negative) */
  price: number;
}

/**
 * Represents order data to be printed
 */
export interface OrderData {
  /** Unique order ID (must be positive) */
  id: number;
  /** Customer name */
  customer: string;
  /** Delivery address (optional) */
  address?: string | null;
  /** List of items in the order (must have at least one item) */
  items: OrderItem[];
  /** Delivery/shipping fee (defaults to 0) */
  deliveryFee: number;
  /** Total order value (calculated automatically: sum of items + deliveryFee) */
  total: number;
}

/**
 * Represents a print job in the system
 */
export interface PrintJob {
  /** Unique job ID (UUID) */
  id: string;
  /** Original order ID */
  orderId: number;
  /** Customer name */
  customer: string;
  /** Total order value */
  total: number;
  /** Timestamp when the job was created */
  timestamp: Date;
  /** Status of the print job */
  status: 'sent' | 'failed';
  /** Number of clients that received the job */
  clientCount: number;
}

/**
 * Represents information about a connected WebSocket client
 */
export interface ClientInfo {
  /** Unique client ID */
  id: string;
  /** Timestamp when the client connected */
  connectedAt: Date;
  /** Socket.io socket ID */
  socketId: string;
}
