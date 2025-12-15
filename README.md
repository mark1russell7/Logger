# @mark1russell7/logger

Standalone structured logger with configurable transports and formatters. Zero dependencies.

## Installation

```bash
npm install github:mark1russell7/logger#main
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application                             │
│                                                                 │
│   logger.info("msg", { data: {...} })                          │
│              │                                                  │
└──────────────┼──────────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Logger                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ level: INFO │  │ context:    │  │ formatter: Simple       │ │
│  │             │  │ "my-app"    │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                           │                                     │
│              ┌────────────┴────────────┐                       │
│              ▼                         ▼                       │
│  ┌─────────────────────┐   ┌─────────────────────┐            │
│  │  ConsoleTransport   │   │   MemoryTransport   │            │
│  │  ┌───────────────┐  │   │  ┌───────────────┐  │            │
│  │  │  Formatter    │  │   │  │   entries[]   │  │            │
│  │  └───────────────┘  │   │  └───────────────┘  │            │
│  └─────────────────────┘   └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```typescript
import { createLogger, LogLevel } from "@mark1russell7/logger";

const logger = createLogger({
  level: LogLevel.DEBUG,
  context: "my-app",
});

logger.info("Application started");
logger.debug("Processing", { data: { userId: 123 } });
logger.error("Failed", { error: new Error("oops") });
```

## Log Levels

| Level | Value | Use Case |
|-------|-------|----------|
| `ERROR` | 0 | Errors requiring attention |
| `WARN` | 1 | Potential issues |
| `INFO` | 2 | General information |
| `DEBUG` | 3 | Development details |
| `TRACE` | 4 | Fine-grained tracing |

Logs are filtered by level - setting `level: LogLevel.INFO` shows ERROR, WARN, and INFO only.

## API Reference

### Logger

```typescript
class Logger {
  // Log methods
  error(message: string, options?: LogOptions): void;
  warn(message: string, options?: LogOptions): void;
  info(message: string, options?: LogOptions): void;
  debug(message: string, options?: LogOptions): void;
  trace(message: string, options?: LogOptions): void;
  log(level: LogLevel, message: string, options?: LogOptions): void;

  // Configuration
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;

  // Child loggers
  child(context: string): Logger;

  // Transport management
  addTransport(transport: Transport): void;
  removeTransport(name: string): boolean;
  flush(): Promise<void>;
  close(): Promise<void>;
}

interface LogOptions {
  context?: string;                    // Override context
  data?: Record<string, unknown>;      // Structured data
  error?: Error;                       // Error object
}
```

### Formatters

| Formatter | Output |
|-----------|--------|
| `SimpleFormatter` | `[LEVEL] message` |
| `TimestampedFormatter` | `[2024-01-15T10:30:00.000Z] [LEVEL] message` |
| `JsonFormatter` | `{"level":"INFO","message":"...","timestamp":"..."}` |

```typescript
import { createLogger, createJsonFormatter } from "@mark1russell7/logger";

const logger = createLogger({
  formatter: createJsonFormatter(),
});
```

### Transports

| Transport | Description |
|-----------|-------------|
| `ConsoleTransport` | Outputs to console (default) |
| `MemoryTransport` | Stores entries in memory (for testing) |
| `CallbackTransport` | Calls custom function |

```typescript
import {
  createLogger,
  createMemoryTransport,
  createCallbackTransport
} from "@mark1russell7/logger";

// Memory transport for testing
const memory = createMemoryTransport();
const logger = createLogger({ transports: [memory] });
logger.info("test");
console.log(memory.getEntries()); // [{ level: 2, message: "test", ... }]

// Callback transport for custom handling
const callback = createCallbackTransport({
  onLog: (entry) => sendToExternalService(entry),
});
```

### Custom Transport

```typescript
import type { Transport, LogEntry } from "@mark1russell7/logger";

const fileTransport: Transport = {
  name: "file",
  write(entry: LogEntry) {
    fs.appendFileSync("app.log", JSON.stringify(entry) + "\n");
  },
  flush() {
    // Sync if buffered
  },
  close() {
    // Cleanup
  },
};
```

## Child Loggers

Create scoped loggers with nested context:

```typescript
const logger = createLogger({ context: "app" });
const dbLogger = logger.child("database");
const queryLogger = dbLogger.child("query");

queryLogger.info("Executing"); // context: "app:database:query"
```

## Default Logger

```typescript
import { getDefaultLogger, setDefaultLogger } from "@mark1russell7/logger";

// Use shared instance
const logger = getDefaultLogger();
logger.info("Using default");

// Replace globally
setDefaultLogger(createLogger({ level: LogLevel.DEBUG }));
```
