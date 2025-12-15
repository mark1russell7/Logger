/**
 * Log Formatters
 *
 * Built-in formatters for log entries.
 */

import type { Formatter, LogEntry } from "./types.js";
import { LOG_LEVEL_NAMES } from "./types.js";

// =============================================================================
// Simple Formatter
// =============================================================================

/**
 * Simple text formatter.
 * Format: [LEVEL] [context] message
 */
export class SimpleFormatter implements Formatter {
  format(entry: LogEntry): string {
    const level = LOG_LEVEL_NAMES[entry.level];
    const ctx = entry.context ? `[${entry.context}] ` : "";
    let msg = `[${level}] ${ctx}${entry.message}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      msg += ` ${JSON.stringify(entry.data)}`;
    }

    if (entry.error) {
      msg += `\n${entry.error.stack ?? entry.error.message}`;
    }

    return msg;
  }
}

// =============================================================================
// Timestamped Formatter
// =============================================================================

/**
 * Formatter with ISO timestamp.
 * Format: [timestamp] [LEVEL] [context] message
 */
export class TimestampedFormatter implements Formatter {
  format(entry: LogEntry): string {
    const level = LOG_LEVEL_NAMES[entry.level];
    const time = entry.timestamp.toISOString();
    const ctx = entry.context ? `[${entry.context}] ` : "";
    let msg = `[${time}] [${level}] ${ctx}${entry.message}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      msg += ` ${JSON.stringify(entry.data)}`;
    }

    if (entry.error) {
      msg += `\n${entry.error.stack ?? entry.error.message}`;
    }

    return msg;
  }
}

// =============================================================================
// JSON Formatter
// =============================================================================

/**
 * JSON formatter for structured logging.
 */
export class JsonFormatter implements Formatter {
  format(entry: LogEntry): string {
    const obj: Record<string, unknown> = {
      level: LOG_LEVEL_NAMES[entry.level],
      message: entry.message,
      timestamp: entry.timestamp.toISOString(),
    };

    if (entry.context) {
      obj["context"] = entry.context;
    }

    if (entry.data) {
      obj["data"] = entry.data;
    }

    if (entry.error) {
      obj["error"] = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    return JSON.stringify(obj);
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a simple formatter.
 */
export function createSimpleFormatter(): Formatter {
  return new SimpleFormatter();
}

/**
 * Create a timestamped formatter.
 */
export function createTimestampedFormatter(): Formatter {
  return new TimestampedFormatter();
}

/**
 * Create a JSON formatter.
 */
export function createJsonFormatter(): Formatter {
  return new JsonFormatter();
}
