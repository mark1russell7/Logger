/**
 * Log Formatters
 *
 * Built-in formatters for log entries.
 */
import type { Formatter, LogEntry } from "./types.js";
/**
 * Simple text formatter.
 * Format: [LEVEL] [context] message
 */
export declare class SimpleFormatter implements Formatter {
    format(entry: LogEntry): string;
}
/**
 * Formatter with ISO timestamp.
 * Format: [timestamp] [LEVEL] [context] message
 */
export declare class TimestampedFormatter implements Formatter {
    format(entry: LogEntry): string;
}
/**
 * JSON formatter for structured logging.
 */
export declare class JsonFormatter implements Formatter {
    format(entry: LogEntry): string;
}
/**
 * Create a simple formatter.
 */
export declare function createSimpleFormatter(): Formatter;
/**
 * Create a timestamped formatter.
 */
export declare function createTimestampedFormatter(): Formatter;
/**
 * Create a JSON formatter.
 */
export declare function createJsonFormatter(): Formatter;
//# sourceMappingURL=formatters.d.ts.map