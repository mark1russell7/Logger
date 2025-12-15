/**
 * Log Transports
 *
 * Built-in transports for log output.
 */

import type { Transport, LogEntry, Formatter } from "./types.js";
import { LogLevel } from "./types.js";
import { SimpleFormatter } from "./formatters.js";

// =============================================================================
// Console Transport
// =============================================================================

/**
 * Console transport options.
 */
export interface ConsoleTransportOptions {
  /** Formatter to use */
  formatter?: Formatter;
  /** Use colors (if supported) */
  colors?: boolean;
}

// Get console from globalThis in a type-safe way
type ConsoleType = {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
  log(message: string): void;
};
const getConsole = (): ConsoleType => (globalThis as unknown as { console: ConsoleType }).console;

/**
 * Console transport - writes to globalThis.console.
 */
export class ConsoleTransport implements Transport {
  readonly name = "console";
  private readonly formatter: Formatter;

  constructor(options: ConsoleTransportOptions = {}) {
    this.formatter = options.formatter ?? new SimpleFormatter();
  }

  write(entry: LogEntry): void {
    const message = this.formatter.format(entry);
    const console = getConsole();

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.debug(message);
        break;
    }
  }
}

// =============================================================================
// Memory Transport (for testing)
// =============================================================================

/**
 * Memory transport - stores entries in memory.
 * Useful for testing.
 */
export class MemoryTransport implements Transport {
  readonly name = "memory";
  readonly entries: LogEntry[] = [];

  write(entry: LogEntry): void {
    this.entries.push(entry);
  }

  clear(): void {
    this.entries.length = 0;
  }

  getEntries(level?: LogLevel): LogEntry[] {
    if (level === undefined) {
      return [...this.entries];
    }
    return this.entries.filter((e) => e.level === level);
  }
}

// =============================================================================
// Callback Transport
// =============================================================================

/**
 * Callback transport options.
 */
export interface CallbackTransportOptions {
  /** Callback to invoke for each entry */
  callback: (entry: LogEntry, formatted: string) => void | Promise<void>;
  /** Formatter to use */
  formatter?: Formatter;
}

/**
 * Callback transport - invokes a callback for each entry.
 * Useful for custom integrations.
 */
export class CallbackTransport implements Transport {
  readonly name = "callback";
  private readonly callback: (entry: LogEntry, formatted: string) => void | Promise<void>;
  private readonly formatter: Formatter;

  constructor(options: CallbackTransportOptions) {
    this.callback = options.callback;
    this.formatter = options.formatter ?? new SimpleFormatter();
  }

  write(entry: LogEntry): void | Promise<void> {
    const formatted = this.formatter.format(entry);
    return this.callback(entry, formatted);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a console transport.
 */
export function createConsoleTransport(options?: ConsoleTransportOptions): Transport {
  return new ConsoleTransport(options);
}

/**
 * Create a memory transport.
 */
export function createMemoryTransport(): MemoryTransport {
  return new MemoryTransport();
}

/**
 * Create a callback transport.
 */
export function createCallbackTransport(options: CallbackTransportOptions): Transport {
  return new CallbackTransport(options);
}
