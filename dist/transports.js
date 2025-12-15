/**
 * Log Transports
 *
 * Built-in transports for log output.
 */
import { LogLevel } from "./types.js";
import { SimpleFormatter } from "./formatters.js";
const getConsole = () => globalThis.console;
/**
 * Console transport - writes to globalThis.console.
 */
export class ConsoleTransport {
    name = "console";
    formatter;
    constructor(options = {}) {
        this.formatter = options.formatter ?? new SimpleFormatter();
    }
    write(entry) {
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
export class MemoryTransport {
    name = "memory";
    entries = [];
    write(entry) {
        this.entries.push(entry);
    }
    clear() {
        this.entries.length = 0;
    }
    getEntries(level) {
        if (level === undefined) {
            return [...this.entries];
        }
        return this.entries.filter((e) => e.level === level);
    }
}
/**
 * Callback transport - invokes a callback for each entry.
 * Useful for custom integrations.
 */
export class CallbackTransport {
    name = "callback";
    callback;
    formatter;
    constructor(options) {
        this.callback = options.callback;
        this.formatter = options.formatter ?? new SimpleFormatter();
    }
    write(entry) {
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
export function createConsoleTransport(options) {
    return new ConsoleTransport(options);
}
/**
 * Create a memory transport.
 */
export function createMemoryTransport() {
    return new MemoryTransport();
}
/**
 * Create a callback transport.
 */
export function createCallbackTransport(options) {
    return new CallbackTransport(options);
}
//# sourceMappingURL=transports.js.map