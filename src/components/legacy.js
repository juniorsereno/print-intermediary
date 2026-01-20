/**
 * Legacy HTTP Handler Component
 * Maintains backward compatibility with existing HTTP POST endpoint
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */
/**
 * LegacyHttpHandler class
 * Handles HTTP POST requests to /api/print endpoint for backward compatibility
 */
export class LegacyHttpHandler {
    validator;
    formatter;
    wsManager;
    history;
    constructor(validator, formatter, wsManager, history) {
        this.validator = validator;
        this.formatter = formatter;
        this.wsManager = wsManager;
        this.history = history;
    }
    /**
     * Handles POST /api/print requests
     * Maintains compatibility with existing HTTP endpoint
     * @param req - Express request object
     * @param res - Express response object
     *
     * Requirements: 6.1, 6.2, 6.3, 6.5
     */
    async handlePrintRequest(req, res) {
        try {
            // Validate order data from request body
            const validationResult = this.validator.validateOrderData(req.body);
            if (!validationResult.success) {
                // Return validation error
                res.status(400).json({
                    success: false,
                    error: validationResult.error,
                    field: validationResult.field,
                });
                return;
            }
            const orderData = validationResult.data;
            // Check if clients are connected
            if (this.wsManager.getClientCount() === 0) {
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
            // Return success response
            res.status(200).json({
                success: true,
                jobId: job.id,
                message: `Print job sent successfully to ${broadcastResult.clientCount} client(s)`,
                clientCount: broadcastResult.clientCount,
            });
        }
        catch (error) {
            // Handle unexpected errors without exposing internals
            console.error('Error in legacy HTTP handler:', error);
            res.status(500).json({
                success: false,
                error: 'An unexpected error occurred while processing the print job',
            });
        }
    }
}
