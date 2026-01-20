/**
 * Logger Utility
 * Provides structured logging with different levels
 * Requirements: 7.2, 7.3, 7.4
 */

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  /**
   * Logs an informational message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Logs a warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Logs an error message
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData = error instanceof Error 
      ? { errorMessage: error.message, errorStack: error.stack, ...data }
      : { error: String(error), ...data };
    
    this.log(LogLevel.ERROR, message, errorData);
  }

  /**
   * Logs a debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      component: this.component,
      message,
      ...(data && { data })
    };

    // Use console.error for ERROR and WARN to ensure visibility
    if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      console.error(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }
}
