// The rows of the API table. Each example calls the package when the page opens, and the page shows the result.
import {
  createCallbackTransport,
  createConsoleTransport,
  createJsonFormatter,
  createLogger,
  createMemoryTransport,
  createSimpleFormatter,
  createTimestampedFormatter,
  getDefaultLogger,
  LOG_LEVEL_NAMES,
  LogLevel,
  parseLogLevel,
  resetDefaultLogger,
  setDefaultLogger,
  type LogEntry,
  type Transport,
} from "@mark1russell7/logger";

/** One example of a row: its code, and the call that gives its result. */
export interface Example {
  readonly code: string;
  readonly run: () => unknown;
}

/** One row of the API table. */
export interface ApiRow {
  readonly names: readonly string[];
  readonly what: string;
  readonly examples: readonly Example[];
}

const sample: LogEntry = {
  level: LogLevel.WARN,
  message: "Disk is almost full",
  context: "app:disk",
  timestamp: new Date("2026-11-03T09:30:00.000Z"),
  data: { free: "2%" },
};

/** This function gives a logger with a memory transport only. */
const withMemory = () => {
  const memory = createMemoryTransport();
  return { memory, logger: createLogger({ context: "app", transports: [memory] }) };
};

const childContext = (): string | undefined => {
  const { logger, memory } = withMemory();
  logger.child("db").child("pool").info("Connected");
  return memory.entries[0]?.context;
};

const childLevel = (): string => {
  const { logger } = withMemory();
  const child = logger.child("db");
  logger.setLevel(LogLevel.TRACE);
  return LOG_LEVEL_NAMES[child.getLevel()];
};

const lateTransport = (): number => {
  const { logger } = withMemory();
  const child = logger.child("db");
  const late = createMemoryTransport();
  logger.addTransport(late);
  child.info("Too early");
  return late.entries.length;
};

const addedFormatter = (): string => {
  let text = "";
  const logger = createLogger({ formatter: createJsonFormatter(), transports: [] });
  logger.addTransport(
    createCallbackTransport({
      callback: (_entry, formatted) => {
        text = formatted;
      },
    }),
  );
  logger.info("Hello");
  return text;
};

const addedWithOption = (): string => {
  let text = "";
  const logger = createLogger({ formatter: createJsonFormatter(), transports: [], formatAddedTransports: true });
  logger.addTransport(
    createCallbackTransport({
      callback: (_entry, formatted) => {
        text = formatted;
      },
    }),
  );
  logger.info("Hello");
  return text;
};

const removeTwice = (): string => {
  const { logger } = withMemory();
  return `${String(logger.removeTransport("memory"))}, ${String(logger.removeTransport("memory"))}`;
};

const withException = (): string | undefined => {
  const { logger, memory } = withMemory();
  logger.errorWithException("Save failed", new Error("Disk full"));
  return memory.entries[0]?.error?.message;
};

const countWarnings = (): number => {
  const { logger, memory } = withMemory();
  logger.warn("One");
  logger.info("Two");
  return memory.getEntries(LogLevel.WARN).length;
};

const logAfterClose = (): number => {
  const { logger, memory } = withMemory();
  void logger.close();
  logger.info("Still here");
  return memory.entries.length;
};

const failedWrite = (): string => {
  const failures: string[] = [];
  const memory = createMemoryTransport();
  const broken: Transport = {
    name: "broken",
    write: () => {
      throw new Error("Disk full");
    },
  };
  const logger = createLogger({
    transports: [broken, memory],
    onTransportError: (error, transport) => {
      failures.push(`${transport.name}: ${(error as Error).message}`);
    },
  });
  logger.info("Saved");
  return `${failures.join()}, memory has ${String(memory.entries.length)}`;
};

const defaultSwap = (): boolean => {
  const mine = createLogger({ transports: [] });
  setDefaultLogger(mine);
  const same = getDefaultLogger() === mine;
  resetDefaultLogger();
  return same && getDefaultLogger() !== mine;
};

/** The rows of the table. */
export const API: readonly ApiRow[] = [
  {
    names: ["parseLogLevel", "LOG_LEVEL_NAMES", "LogLevel"],
    what: "These exports change between the name and the number of a level. A lower number is more severe.",
    examples: [
      { code: 'parseLogLevel("warn")', run: () => parseLogLevel("warn") },
      { code: 'parseLogLevel("loud")', run: () => parseLogLevel("loud") },
      { code: "LOG_LEVEL_NAMES[LogLevel.DEBUG]", run: () => LOG_LEVEL_NAMES[LogLevel.DEBUG] },
    ],
  },
  {
    names: ["createSimpleFormatter", "createTimestampedFormatter", "createJsonFormatter"],
    what: "Each formatter makes one text from a `LogEntry`.",
    examples: [
      { code: "createSimpleFormatter().format(entry)", run: () => createSimpleFormatter().format(sample) },
      { code: "createTimestampedFormatter().format(entry)", run: () => createTimestampedFormatter().format(sample) },
      { code: "createJsonFormatter().format(entry)", run: () => createJsonFormatter().format(sample) },
    ],
  },
  {
    names: ["child"],
    what: "A child adds its name to the context of its parent, with a colon.",
    examples: [{ code: 'app.child("db").child("pool"), then info, then entry.context', run: childContext }],
  },
  {
    names: ["child", "setLevel"],
    what: "A child copies the level of its parent once. A later `setLevel` on the parent does not change the child.",
    examples: [{ code: "app.setLevel(LogLevel.TRACE), then child.getLevel()", run: childLevel }],
  },
  {
    names: ["child", "addTransport"],
    what: "A child copies the list of transports once. A transport that its parent adds later gets no record from the child.",
    examples: [{ code: "app.addTransport(late), then child.info(...), then late.entries.length", run: lateTransport }],
  },
  {
    names: ["addTransport", "formatter"],
    what: "By default, the option `formatter` reaches only the transports in the options. With `formatAddedTransports`, it also reaches a transport from `addTransport`, if that transport has no formatter of its own.",
    examples: [
      { code: "createLogger({ formatter: json }), then addTransport(callback), then info", run: addedFormatter },
      { code: "createLogger({ formatter: json, formatAddedTransports: true }), then addTransport(callback), then info", run: addedWithOption },
    ],
  },
  {
    names: ["removeTransport"],
    what: "This method removes the first transport with the name, and tells if it found one.",
    examples: [{ code: 'removeTransport("memory") twice', run: removeTwice }],
  },
  {
    names: ["errorWithException"],
    what: "This method logs at `ERROR`, with an `Error` object in the entry.",
    examples: [{ code: 'errorWithException("Save failed", new Error("Disk full"))', run: withException }],
  },
  {
    names: ["MemoryTransport"],
    what: "This transport keeps each `LogEntry`. The method `getEntries` filters by one exact level.",
    examples: [{ code: "memory.getEntries(LogLevel.WARN).length", run: countWarnings }],
  },
  {
    names: ["flush", "close"],
    what: "These methods call the same method of each transport that has it, and wait for its promise. They do not wait for a pending `write`. The built-in transports do not have it.",
    examples: [
      { code: "typeof createConsoleTransport().flush", run: () => typeof createConsoleTransport().flush },
      { code: "typeof createMemoryTransport().close", run: () => typeof (createMemoryTransport() as Transport).close },
    ],
  },
  {
    names: ["close"],
    what: "The logger stays open after `close()`. Each transport decides what a later write does.",
    examples: [{ code: "close(), then info, then memory.entries.length", run: logAfterClose }],
  },
  {
    names: ["onTransportError"],
    what: "A failed write goes to this hook, and the other transports still get the record.",
    examples: [{ code: "createLogger({ transports: [broken, memory], onTransportError })", run: failedWrite }],
  },
  {
    names: ["getDefaultLogger", "setDefaultLogger", "resetDefaultLogger"],
    what: "These functions keep one shared logger for the process.",
    examples: [{ code: "setDefaultLogger(mine), then getDefaultLogger() === mine", run: defaultSwap }],
  },
];

/** This function gives the result of an example as text. */
export function result(example: Example): string {
  try {
    const value = example.run();
    return typeof value === "string" ? value : (JSON.stringify(value) ?? "undefined");
  } catch (error) {
    return `throws ${error instanceof Error ? error.message : String(error)}`;
  }
}
