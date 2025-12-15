/**
 * Logger
 *
 * Standalone logger with configurable transports and formatters.
 * Zero dependencies.
 *
 * @example
 * ```typescript
 * import { createLogger, LogLevel } from "@mark1russell7/logger";
 *
 * const logger = createLogger({
 *   level: LogLevel.DEBUG,
 *   context: "my-app",
 * });
 *
 * logger.info("Application started");
 * logger.debug("Debug info", { data: { userId: 123 } });
 * logger.error("Something failed", { error: new Error("oops") });
 * ```
 */

// =============================================================================
// Types
// =============================================================================

export {
  LogLevel,
  LOG_LEVEL_NAMES,
  parseLogLevel,
} from "./types.js";

export type {
  LogEntry,
  Transport,
  Formatter,
  LoggerOptions,
  LogOptions,
} from "./types.js";

// =============================================================================
// Logger
// =============================================================================

export {
  Logger,
  createLogger,
  getDefaultLogger,
  setDefaultLogger,
  resetDefaultLogger,
} from "./logger.js";

// =============================================================================
// Formatters
// =============================================================================

export {
  SimpleFormatter,
  TimestampedFormatter,
  JsonFormatter,
  createSimpleFormatter,
  createTimestampedFormatter,
  createJsonFormatter,
} from "./formatters.js";

// =============================================================================
// Transports
// =============================================================================

export {
  ConsoleTransport,
  MemoryTransport,
  CallbackTransport,
  createConsoleTransport,
  createMemoryTransport,
  createCallbackTransport,
} from "./transports.js";

export type {
  ConsoleTransportOptions,
  CallbackTransportOptions,
} from "./transports.js";
