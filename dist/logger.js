/**
 * Logger
 *
 * Main logger implementation.
 */
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
    level;
    context;
    transports;
    formatter;
    constructor(options = {}) {
        this.level = options.level ?? LogLevel.INFO;
        this.context = options.context;
        this.transports = options.transports ?? [new ConsoleTransport()];
        this.formatter = options.formatter ?? new SimpleFormatter();
    }
    /**
     * Log at a specific level.
     */
    log(level, message, options) {
        if (level > this.level) {
            return;
        }
        const ctx = options?.context ?? this.context;
        const entry = {
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
    error(message, options) {
        this.log(LogLevel.ERROR, message, options);
    }
    /**
     * Log an error with an Error object.
     */
    errorWithException(message, error, options) {
        this.log(LogLevel.ERROR, message, { ...options, error });
    }
    /**
     * Log a warning.
     */
    warn(message, options) {
        this.log(LogLevel.WARN, message, options);
    }
    /**
     * Log info.
     */
    info(message, options) {
        this.log(LogLevel.INFO, message, options);
    }
    /**
     * Log debug.
     */
    debug(message, options) {
        this.log(LogLevel.DEBUG, message, options);
    }
    /**
     * Log trace.
     */
    trace(message, options) {
        this.log(LogLevel.TRACE, message, options);
    }
    /**
     * Create a child logger with a specific context.
     */
    child(context) {
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
    setLevel(level) {
        this.level = level;
    }
    /**
     * Get the current log level.
     */
    getLevel() {
        return this.level;
    }
    /**
     * Add a transport.
     */
    addTransport(transport) {
        this.transports.push(transport);
    }
    /**
     * Remove a transport by name.
     */
    removeTransport(name) {
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
    async flush() {
        await Promise.all(this.transports.map((t) => t.flush?.()));
    }
    /**
     * Close all transports.
     */
    async close() {
        await Promise.all(this.transports.map((t) => t.close?.()));
    }
}
// =============================================================================
// Factory
// =============================================================================
/**
 * Create a logger.
 */
export function createLogger(options) {
    return new Logger(options);
}
// =============================================================================
// Default Logger
// =============================================================================
let defaultLogger = null;
/**
 * Get the default logger instance.
 * Creates one with console transport if not set.
 */
export function getDefaultLogger() {
    if (!defaultLogger) {
        defaultLogger = new Logger();
    }
    return defaultLogger;
}
/**
 * Set the default logger instance.
 */
export function setDefaultLogger(logger) {
    defaultLogger = logger;
}
/**
 * Reset the default logger.
 */
export function resetDefaultLogger() {
    defaultLogger = null;
}
//# sourceMappingURL=logger.js.map