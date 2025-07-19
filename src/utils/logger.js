import winston from 'winston';
import path from 'path';

/**
 * Create a configured logger instance
 * @param {Object} options - Logger configuration options
 * @param {string} options.level - Log level (debug, info, warn, error)
 * @param {string} options.outputDir - Directory for log files
 * @param {boolean} options.enableFile - Enable file logging
 * @returns {winston.Logger} Configured logger instance
 */
export function createLogger(options = {}) {
  const {
    level = 'info',
    outputDir = './output',
    enableFile = true,
  } = options;

  // Create timestamp for log file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `mkdemo_${timestamp}.log`;
  const logFilePath = path.join(outputDir, logFileName);

  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  // Define console format
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
      format: 'HH:mm:ss',
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let log = `${timestamp} [${level}] ${message}`;
      
      // Add metadata if present
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      
      return log;
    }),
  );

  // Configure transports
  const transports = [
    new winston.transports.Console({
      level,
      format: consoleFormat,
    }),
  ];

  // Add file transport if enabled
  if (enableFile) {
    transports.push(
      new winston.transports.File({
        filename: logFilePath,
        level: 'debug', // Always log everything to file
        format: logFormat,
      }),
    );
  }

  // Create logger
  const logger = winston.createLogger({
    level,
    format: logFormat,
    transports,
    // Prevent winston from exiting on error
    exitOnError: false,
  });

  // Add custom methods for better usability
  logger.logFilePath = logFilePath;

  return logger;
}

/**
 * Create a child logger with additional context
 * @param {winston.Logger} parentLogger - Parent logger instance
 * @param {Object} context - Additional context to include in logs
 * @returns {winston.Logger} Child logger with context
 */
export function createChildLogger(parentLogger, context = {}) {
  return parentLogger.child(context);
}

/**
 * Log levels available
 */
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};