/**
 * Logger Types
 *
 * Core types for the logging system.
 */
/**
 * Log level enumeration.
 * Lower values = more severe.
 */
export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}
/**
 * Log level names for display.
 */
export declare const LOG_LEVEL_NAMES: Record<LogLevel, string>;
/**
 * Parse a log level from string.
 */
export declare function parseLogLevel(level: string): LogLevel | null;
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
    /**
     * Adopt a default formatter provided by the owning Logger
     * (`LoggerOptions.formatter`). Implementations should only apply it if the
     * transport was not constructed with its own explicit formatter. Optional:
     * transports that don't format (e.g. an in-memory buffer) may omit it.
     */
    setDefaultFormatter?(formatter: Formatter): void;
}
/**
 * Formatter interface - formats log entries for output.
 */
export interface Formatter {
    /** Format a log entry to string */
    format(entry: LogEntry): string;
}
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
    /**
     * Called when a transport's `write()` throws synchronously or returns a
     * rejecting promise. Lets callers observe/report transport failures instead
     * of them surfacing as unhandled promise rejections (which crash the
     * process on a default Node configuration). If omitted, such failures are
     * silently swallowed.
     */
    onTransportError?: (error: unknown, transport: Transport) => void;
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
//# sourceMappingURL=types.d.ts.map