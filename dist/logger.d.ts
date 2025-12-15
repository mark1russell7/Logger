/**
 * Logger
 *
 * Main logger implementation.
 */
import type { LoggerOptions, LogOptions, Transport } from "./types.js";
import { LogLevel } from "./types.js";
/**
 * Logger class.
 */
export declare class Logger {
    private level;
    private context;
    private transports;
    private formatter;
    constructor(options?: LoggerOptions);
    /**
     * Log at a specific level.
     */
    log(level: LogLevel, message: string, options?: LogOptions): void;
    /**
     * Log an error.
     */
    error(message: string, options?: LogOptions): void;
    /**
     * Log an error with an Error object.
     */
    errorWithException(message: string, error: Error, options?: Omit<LogOptions, "error">): void;
    /**
     * Log a warning.
     */
    warn(message: string, options?: LogOptions): void;
    /**
     * Log info.
     */
    info(message: string, options?: LogOptions): void;
    /**
     * Log debug.
     */
    debug(message: string, options?: LogOptions): void;
    /**
     * Log trace.
     */
    trace(message: string, options?: LogOptions): void;
    /**
     * Create a child logger with a specific context.
     */
    child(context: string): Logger;
    /**
     * Set the log level.
     */
    setLevel(level: LogLevel): void;
    /**
     * Get the current log level.
     */
    getLevel(): LogLevel;
    /**
     * Add a transport.
     */
    addTransport(transport: Transport): void;
    /**
     * Remove a transport by name.
     */
    removeTransport(name: string): boolean;
    /**
     * Flush all transports.
     */
    flush(): Promise<void>;
    /**
     * Close all transports.
     */
    close(): Promise<void>;
}
/**
 * Create a logger.
 */
export declare function createLogger(options?: LoggerOptions): Logger;
/**
 * Get the default logger instance.
 * Creates one with console transport if not set.
 */
export declare function getDefaultLogger(): Logger;
/**
 * Set the default logger instance.
 */
export declare function setDefaultLogger(logger: Logger): void;
/**
 * Reset the default logger.
 */
export declare function resetDefaultLogger(): void;
//# sourceMappingURL=logger.d.ts.map