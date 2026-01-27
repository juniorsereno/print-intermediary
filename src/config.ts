/**
 * Configuration module for MCP Thermal Print Server
 * Loads configuration from environment variables with sensible defaults
 * Requirements: 1.1
 */

export interface ServerConfig {
  /** HTTP server port */
  port: number;
  
  /** Store ID for Saiposprt format */
  idStore: number;
  
  /** User ID for Saiposprt format */
  idUser: number;
  
  /** Maximum number of print jobs to store in history */
  maxHistorySize: number;
  
  /** Server name for MCP protocol */
  serverName: string;
  
  /** Server version */
  serverVersion: string;
}

/**
 * Loads configuration from environment variables
 * @returns ServerConfig object with all configuration values
 */
export function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    idStore: parseInt(process.env.ID_STORE || '72144', 10),
    idUser: parseInt(process.env.ID_USER || '1', 10),
    maxHistorySize: parseInt(process.env.MAX_HISTORY_SIZE || '1000', 10),
    serverName: process.env.SERVER_NAME || 'mcp-thermal-print-server',
    serverVersion: process.env.SERVER_VERSION || '1.0.0',
  };
}

/**
 * Validates configuration values
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: ServerConfig): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}. Must be between 1 and 65535.`);
  }
  
  if (config.idStore < 1) {
    throw new Error(`Invalid idStore: ${config.idStore}. Must be a positive integer.`);
  }
  
  if (config.idUser < 1) {
    throw new Error(`Invalid idUser: ${config.idUser}. Must be a positive integer.`);
  }
  
  if (config.maxHistorySize < 1) {
    throw new Error(`Invalid maxHistorySize: ${config.maxHistorySize}. Must be a positive integer.`);
  }
  
  if (!config.serverName || config.serverName.trim().length === 0) {
    throw new Error('Invalid serverName: must be a non-empty string.');
  }
  
  if (!config.serverVersion || config.serverVersion.trim().length === 0) {
    throw new Error('Invalid serverVersion: must be a non-empty string.');
  }
}

/**
 * Loads and validates configuration
 * @returns Validated ServerConfig object
 * @throws Error if configuration is invalid
 */
export function getConfig(): ServerConfig {
  const config = loadConfig();
  validateConfig(config);
  return config;
}
