/**
 * Logger
 *
 * Main logger implementation.
 */

import type { LogEntry, LoggerOptions, LogOptions, Transport, Formatter } from "./types.js";
import { LogLevel } from "./types.js";
import { ConsoleTransport } from "./transports.js";
import { SimpleFormatter } from "./formatters.js";

// =============================================================================
// Logger Class
// =============================================================================

/**
 * Logger class.
 */
export class Logger {
  private level: LogLevel;
  private context: string | undefined;
  private transports: Transport[];
  private formatter: Formatter;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.context = options.context;
    this.transports = options.transports ?? [new ConsoleTransport()];
    this.formatter = options.formatter ?? new SimpleFormatter();
  }

  /**
   * Log at a specific level.
   */
  log(level: LogLevel, message: string, options?: LogOptions): void {
    if (level > this.level) {
      return;
    }

    const ctx = options?.context ?? this.context;
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
    };
    if (ctx !== undefined) {
      entry.context = ctx;
    }
    if (options?.data !== undefined) {
      entry.data = options.data;
    }
    if (options?.error !== undefined) {
      entry.error = options.error;
    }

    for (const transport of this.transports) {
      transport.write(entry);
    }
  }

  /**
   * Log an error.
   */
  error(message: string, options?: LogOptions): void {
    this.log(LogLevel.ERROR, message, options);
  }

  /**
   * Log an error with an Error object.
   */
  errorWithException(message: string, error: Error, options?: Omit<LogOptions, "error">): void {
    this.log(LogLevel.ERROR, message, { ...options, error });
  }

  /**
   * Log a warning.
   */
  warn(message: string, options?: LogOptions): void {
    this.log(LogLevel.WARN, message, options);
  }

  /**
   * Log info.
   */
  info(message: string, options?: LogOptions): void {
    this.log(LogLevel.INFO, message, options);
  }

  /**
   * Log debug.
   */
  debug(message: string, options?: LogOptions): void {
    this.log(LogLevel.DEBUG, message, options);
  }

  /**
   * Log trace.
   */
  trace(message: string, options?: LogOptions): void {
    this.log(LogLevel.TRACE, message, options);
  }

  /**
   * Create a child logger with a specific context.
   */
  child(context: string): Logger {
    return new Logger({
      level: this.level,
      context: this.context ? `${this.context}:${context}` : context,
      transports: this.transports,
      formatter: this.formatter,
    });
  }

  /**
   * Set the log level.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level.
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Add a transport.
   */
  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  /**
   * Remove a transport by name.
   */
  removeTransport(name: string): boolean {
    const index = this.transports.findIndex((t) => t.name === name);
    if (index !== -1) {
      this.transports.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Flush all transports.
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.transports.map((t) => t.flush?.())
    );
  }

  /**
   * Close all transports.
   */
  async close(): Promise<void> {
    await Promise.all(
      this.transports.map((t) => t.close?.())
    );
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a logger.
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

// =============================================================================
// Default Logger
// =============================================================================

let defaultLogger: Logger | null = null;

/**
 * Get the default logger instance.
 * Creates one with console transport if not set.
 */
export function getDefaultLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}

/**
 * Set the default logger instance.
 */
export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Reset the default logger.
 */
export function resetDefaultLogger(): void {
  defaultLogger = null;
}
