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
  private onTransportError: ((error: unknown, transport: Transport) => void) | undefined;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.context = options.context;
    this.transports = options.transports ?? [new ConsoleTransport()];
    this.formatter = options.formatter ?? new SimpleFormatter();
    this.onTransportError = options.onTransportError;
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
      try {
        const result = transport.write(entry);
        // A transport may write asynchronously (`write` returns a promise).
        // Attach a rejection handler so a failing async transport does not
        // become an unhandled rejection that crashes the process.
        if (result && typeof (result as PromiseLike<void>).then === "function") {
          (result as Promise<void>).catch((error) => this.handleTransportError(transport, error));
        }
      } catch (error) {
        // A transport that throws synchronously must not prevent the remaining
        // transports from receiving the entry.
        this.handleTransportError(transport, error);
      }
    }
  }

  /**
   * Report a transport failure via the configured hook, if any.
   * The hook itself is guarded so a faulty handler can never crash the logger.
   */
  private handleTransportError(transport: Transport, error: unknown): void {
    if (this.onTransportError) {
      try {
        this.onTransportError(error, transport);
      } catch {
        // Intentionally ignored: the error handler must never throw.
      }
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
    const options: LoggerOptions = {
      level: this.level,
      context: this.context ? `${this.context}:${context}` : context,
      // Copy the array so addTransport/removeTransport on the child does not
      // mutate the parent's transport list (and vice versa). The transport
      // instances themselves are still shared, so writes continue to fan out
      // to the same destinations.
      transports: [...this.transports],
      formatter: this.formatter,
    };
    if (this.onTransportError) {
      options.onTransportError = this.onTransportError;
    }
    return new Logger(options);
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
