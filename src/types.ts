/**
 * Logger Types
 *
 * Core types for the logging system.
 */

// =============================================================================
// Log Levels
// =============================================================================

/**
 * Log level enumeration.
 * Lower values = more severe.
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

/**
 * Log level names for display.
 */
export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.WARN]: "WARN",
  [LogLevel.INFO]: "INFO",
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.TRACE]: "TRACE",
};

/**
 * Parse a log level from string.
 */
export function parseLogLevel(level: string): LogLevel | null {
  const upper = level.toUpperCase();
  const entry = Object.entries(LOG_LEVEL_NAMES).find(([, name]) => name === upper);
  return entry ? (Number(entry[0]) as LogLevel) : null;
}

// =============================================================================
// Log Entry
// =============================================================================

/**
 * A single log entry.
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Context/source of the log (e.g., module name) */
  context?: string;
  /** Timestamp */
  timestamp: Date;
  /** Additional structured data */
  data?: Record<string, unknown>;
  /** Error object if logging an error */
  error?: Error;
}

// =============================================================================
// Transport
// =============================================================================

/**
 * Transport interface - handles outputting log entries.
 */
export interface Transport {
  /** Transport name for identification */
  name: string;
  /** Write a log entry */
  write(entry: LogEntry): void | Promise<void>;
  /** Flush any buffered entries (optional) */
  flush?(): void | Promise<void>;
  /** Close the transport (optional) */
  close?(): void | Promise<void>;
}

// =============================================================================
// Formatter
// =============================================================================

/**
 * Formatter interface - formats log entries for output.
 */
export interface Formatter {
  /** Format a log entry to string */
  format(entry: LogEntry): string;
}

// =============================================================================
// Logger Options
// =============================================================================

/**
 * Options for creating a logger.
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel;
  /** Default context for all logs */
  context?: string;
  /** Transports to write to */
  transports?: Transport[];
  /** Default formatter for transports that don't have one */
  formatter?: Formatter;
}

/**
 * Options for a single log call.
 */
export interface LogOptions {
  /** Override context for this log */
  context?: string;
  /** Additional structured data */
  data?: Record<string, unknown>;
  /** Error object */
  error?: Error;
}
