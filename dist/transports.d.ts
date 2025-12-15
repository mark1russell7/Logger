/**
 * Log Transports
 *
 * Built-in transports for log output.
 */
import type { Transport, LogEntry, Formatter } from "./types.js";
import { LogLevel } from "./types.js";
/**
 * Console transport options.
 */
export interface ConsoleTransportOptions {
    /** Formatter to use */
    formatter?: Formatter;
    /** Use colors (if supported) */
    colors?: boolean;
}
/**
 * Console transport - writes to globalThis.console.
 */
export declare class ConsoleTransport implements Transport {
    readonly name = "console";
    private readonly formatter;
    constructor(options?: ConsoleTransportOptions);
    write(entry: LogEntry): void;
}
/**
 * Memory transport - stores entries in memory.
 * Useful for testing.
 */
export declare class MemoryTransport implements Transport {
    readonly name = "memory";
    readonly entries: LogEntry[];
    write(entry: LogEntry): void;
    clear(): void;
    getEntries(level?: LogLevel): LogEntry[];
}
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
export declare class CallbackTransport implements Transport {
    readonly name = "callback";
    private readonly callback;
    private readonly formatter;
    constructor(options: CallbackTransportOptions);
    write(entry: LogEntry): void | Promise<void>;
}
/**
 * Create a console transport.
 */
export declare function createConsoleTransport(options?: ConsoleTransportOptions): Transport;
/**
 * Create a memory transport.
 */
export declare function createMemoryTransport(): MemoryTransport;
/**
 * Create a callback transport.
 */
export declare function createCallbackTransport(options: CallbackTransportOptions): Transport;
//# sourceMappingURL=transports.d.ts.map