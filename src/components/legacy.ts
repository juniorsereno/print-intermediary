/**
 * Legacy HTTP Handler Component
 * Maintains backward compatibility with existing HTTP POST endpoint
 * Requirements: 6.1, 6.2, 6.3, 6.5, 7.1, 7.2, 7.3, 7.5
 */

import type { Request, Response } from 'express';
import { DataValidator } from './validator.js';
import { SaiposFormatter } from './formatter.js';
import { WebSocketManager } from './websocket.js';
import { PrintHistory } from './history.js';
import { Logger } from '../utils/logger.js';
import type { OrderData } from '../types/models.js';

/**
 * LegacyHttpHandler class
 * Handles HTTP POST requests to /api/print endpoint for backward compatibility
 */
export class LegacyHttpHandler {
  private logger: Logger;

  constructor(
    private validator: DataValidator,
    private formatter: SaiposFormatter,
    private wsManager: WebSocketManager,
    private history: PrintHistory
  ) {
    this.logger = new Logger('LegacyHttpHandler');
  }

  /**
   * Handles POST /api/print requests
   * Maintains compatibility with existing HTTP endpoint
   * @param req - Express request object
   * @param res - Express response object
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.5, 7.1, 7.2, 7.3, 7.5
   */
  async handlePrintRequest(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('Received legacy HTTP print request');
      
      // Validate order data from request body
      const validationResult = this.validator.validateOrderData(req.body);
      
      if (!validationResult.success) {
        // Requirement 7.2: Return validation error
        this.logger.warn('Legacy HTTP request validation failed', { 
          error: validationResult.error,
          field: validationResult.field 
        });
        
        res.status(400).json({
          success: false,
          error: validationResult.error,
          field: validationResult.field,
        });
        return;
      }

      const orderData = validationResult.data as OrderData;

      // Check if clients are connected
      if (this.wsManager.getClientCount() === 0) {
        // Requirement 7.3: Return error when no clients connected
        this.logger.warn('Legacy HTTP request rejected - no clients connected', { 
          orderId: orderData.id 
        });
        
        res.status(503).json({
          success: false,
          message: 'No printers connected',
        });
        return;
      }

      // Format order data to Saiposprt
      const formattedData = this.formatter.format(orderData);

      // Broadcast to connected clients
      const broadcastResult = this.wsManager.broadcast(formattedData);

      if (!broadcastResult.success) {
        // Add failed job to history
        const job = this.history.add({
          orderId: orderData.id,
          customer: orderData.customer,
          total: orderData.total,
          status: 'failed',
          clientCount: 0,
        });

        this.logger.error('Legacy HTTP broadcast failed', undefined, { 
          jobId: job.id,
          orderId: orderData.id,
          error: broadcastResult.error 
        });

        res.status(500).json({
          success: false,
          message: broadcastResult.error || 'Broadcast failed',
          jobId: job.id,
        });
        return;
      }

      // Add successful job to history
      const job = this.history.add({
        orderId: orderData.id,
        customer: orderData.customer,
        total: orderData.total,
        status: 'sent',
        clientCount: broadcastResult.clientCount,
      });

      // Requirement 7.1: Return success response
      this.logger.info('Legacy HTTP print job sent successfully', { 
        jobId: job.id,
        orderId: orderData.id,
        clientCount: broadcastResult.clientCount 
      });

      res.status(200).json({
        success: true,
        jobId: job.id,
        message: `Print job sent successfully to ${broadcastResult.clientCount} client(s)`,
        clientCount: broadcastResult.clientCount,
      });
    } catch (error) {
      // Requirement 7.5: Handle unexpected errors without exposing internals
      this.logger.error('Unexpected error in legacy HTTP handler', error);
      
      res.status(500).json({
        success: false,
        error: 'An unexpected error occurred while processing the print job',
      });
    }
  }
}
