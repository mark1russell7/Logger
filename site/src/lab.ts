/**
 * The real logger of the page, and the record of what it does. This module has no DOM, so a test runs it in Node.js.
 *
 * Each result comes from the package. The lab does not repeat the level check. A hidden transport (the tap) sits first
 * on each logger, and `Logger.log` calls it only for a record that passes the filter. The real transports stay behind a
 * thin wrapper that tells what each one did with the record.
 */
import {
  createCallbackTransport,
  createConsoleTransport,
  createJsonFormatter,
  createLogger,
  createMemoryTransport,
  createSimpleFormatter,
  createTimestampedFormatter,
  LOG_LEVEL_NAMES,
  LogLevel,
  type Formatter,
  type LogEntry,
  type Logger,
  type LogOptions,
  type Transport,
} from "@mark1russell7/logger";
import { BatchTransport } from "./batch-transport.ts";

/** The levels, from the most severe to the least severe. */
export const LEVELS = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE] as const;

/** The name of a log method of `Logger`. */
export type LevelName = "error" | "warn" | "info" | "debug" | "trace";

/** This function gives the name of the log method for a level. The page also uses it as the class of the level. */
export const levelName = (level: LogLevel): LevelName => LOG_LEVEL_NAMES[level].toLowerCase() as LevelName;

/** The formatters of the package. */
export const FORMATTERS = {
  simple: { label: "Simple", className: "SimpleFormatter", factory: "createSimpleFormatter", make: createSimpleFormatter },
  timestamped: { label: "Timestamped", className: "TimestampedFormatter", factory: "createTimestampedFormatter", make: createTimestampedFormatter },
  json: { label: "JSON", className: "JsonFormatter", factory: "createJsonFormatter", make: createJsonFormatter },
} as const;

/** The name of a formatter of the page. */
export type FormatterId = keyof typeof FORMATTERS;

/** The transports of the page. */
export const TRANSPORTS = ["console", "memory", "callback", "batch"] as const;

/** The name of a transport of the page. */
export type TransportId = (typeof TRANSPORTS)[number];

/** What the page callback does for each record. */
export type CallbackMode = "ok" | "slow" | "throws" | "rejects";

/** A console method that `ConsoleTransport` calls. */
export type ConsoleMethod = "error" | "warn" | "info" | "debug";

const CONSOLE_METHODS: readonly ConsoleMethod[] = ["error", "warn", "info", "debug"];

/** One call of a console method. */
export interface ConsoleLine {
  readonly method: ConsoleMethod;
  readonly text: string;
}

/** One call of the page callback. */
export interface CallbackCall {
  readonly entry: LogEntry;
  readonly formatted: string;
}

/** What one transport did with one record. */
export interface Delivery {
  readonly transport: TransportId;
  state: "done" | "pending" | "failed";
  /** The text that the formatter gave to this transport. A transport with no formatter has no text. */
  formatted?: string | undefined;
  /** The place of the result, for example `console.warn` or `entries[3]`. */
  where?: string | undefined;
  /** The message of the failure. */
  error?: string | undefined;
}

/** The path of one record through the logger. */
export interface Trace {
  readonly id: number;
  /** The context of the logger that took the call. */
  readonly logger: string;
  /** The code of the call. */
  readonly call: string;
  readonly level: LogLevel;
  readonly message: string;
  /** The level of the logger at the call, from `getLevel()`. */
  readonly threshold: LogLevel;
  readonly formatter: FormatterId;
  /** The transports on the logger at the call. */
  readonly attached: readonly TransportId[];
  /** True when the tap got the record: the filter let it pass. */
  passed: boolean;
  /** The `LogEntry` that the logger made. A dropped record has no entry. */
  entry?: LogEntry | undefined;
  readonly deliveries: Delivery[];
}

/** A logger of the tree of the page. */
export interface LoggerNode {
  readonly id: number;
  /** The name for the code of a call, for example `db`. */
  readonly name: string;
  /** The context that the logger gives to its records. */
  readonly context: string;
  readonly depth: number;
  readonly logger: Logger;
  readonly attached: Set<TransportId>;
}

/** A report of a transport failure, from the hook `onTransportError`. */
export interface TransportFailure {
  readonly transport: string;
  readonly message: string;
}

/** The result of `flush()` or `close()`. */
export interface LifecycleResult {
  readonly action: "flush" | "close";
  readonly logger: string;
  /** The transports of the logger with the method. */
  readonly with: readonly TransportId[];
  /** The transports of the logger without the method. */
  readonly without: readonly TransportId[];
  /** The lines that left the batch buffer. */
  readonly lines: number;
  /** The real time of the call in milliseconds. */
  readonly ms: number;
  readonly error?: string | undefined;
}

/** The times of the lab in milliseconds. A test gives short times. */
export interface LabTimes {
  readonly batchSendMs: number;
  readonly slowCallbackMs: number;
}

const DEFAULT_TIMES: LabTimes = { batchSendMs: 450, slowCallbackMs: 900 };

/** The number of traces that the lab keeps. */
const TRACE_LIMIT = 200;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const isPromise = (value: unknown): value is Promise<void> => typeof (value as PromiseLike<void> | undefined)?.then === "function";

/** This function gives a name for code from the name of a logger. */
const identifier = (name: string): string => {
  const clean = name.replace(/[^A-Za-z0-9_$]+/g, "_").replace(/^(?=[0-9])/, "_");
  return clean === "" ? "child" : clean;
};

/**
 * This function runs `write` and gives its console calls. `ConsoleTransport` reads `globalThis.console` at each write,
 * so the real transport calls the methods that this function sets. They go to the page. With `forward`, they also go
 * to the console of the browser.
 */
export function captureConsole(write: () => void, forward: boolean): ConsoleLine[] {
  const target = globalThis.console;
  const saved = CONSOLE_METHODS.map((method) => target[method]);
  const lines: ConsoleLine[] = [];
  CONSOLE_METHODS.forEach((method, index) => {
    target[method] = (text: string) => {
      lines.push({ method, text });
      if (forward) saved[index]?.call(target, text);
    };
  });
  try {
    write();
  } finally {
    CONSOLE_METHODS.forEach((method, index) => {
      const original = saved[index];
      if (original !== undefined) target[method] = original;
    });
  }
  return lines;
}

/** This function gives a `LogEntry` as plain JSON values. `JSON.stringify` gives `{}` for an `Error`. */
export function plainEntry(entry: LogEntry): Record<string, unknown> {
  return {
    level: entry.level,
    message: entry.message,
    ...(entry.context === undefined ? {} : { context: entry.context }),
    timestamp: entry.timestamp.toISOString(),
    ...(entry.data === undefined ? {} : { data: entry.data }),
    ...(entry.error === undefined ? {} : { error: { name: entry.error.name, message: entry.error.message } }),
  };
}

export class Lab {
  /** The loggers, each one after its parent. */
  readonly nodes: LoggerNode[] = [];
  /** The newest record is first. */
  readonly traces: Trace[] = [];
  /** The calls of the page. The newest call is first. */
  readonly calls: string[] = [];
  readonly failures: TransportFailure[] = [];
  readonly consoleLines: ConsoleLine[] = [];
  readonly callbackCalls: CallbackCall[] = [];
  readonly memory = createMemoryTransport();
  readonly batch: BatchTransport;

  /** The formatter of the page. Each new record uses it. */
  formatterId: FormatterId = "simple";
  callbackMode: CallbackMode = "ok";
  /** True: the console lines also go to the console of the browser. */
  devtools = false;
  /** The running `flush()` or `close()`. */
  busy: "flush" | "close" | undefined;
  lifecycle: LifecycleResult | undefined;
  sent = 0;
  passed = 0;
  dropped = 0;

  private readonly times: LabTimes;
  private readonly onChange: () => void;
  private readonly inner: Record<TransportId, Transport>;
  private readonly observed: Record<TransportId, Transport>;
  private current: Trace | undefined;
  private formatted: string | undefined;
  private real: Formatter = FORMATTERS.simple.make();
  private nextId = 1;

  constructor(onChange: () => void = () => {}, times: LabTimes = DEFAULT_TIMES) {
    this.onChange = onChange;
    this.times = times;

    // The package has no call that changes the formatter of a running logger. So the page gives one object to the
    // logger and to each transport, and this object forwards each record to the real formatter of the visitor.
    const formatter: Formatter = {
      format: (entry) => {
        const text = this.real.format(entry);
        this.formatted = text;
        return text;
      },
    };
    this.batch = new BatchTransport(formatter, times.batchSendMs);
    this.inner = {
      console: createConsoleTransport({ formatter }),
      memory: this.memory,
      callback: createCallbackTransport({ formatter, callback: (entry, text) => this.onCallback(entry, text) }),
      batch: this.batch,
    };
    this.observed = {
      console: this.observe("console"),
      memory: this.observe("memory"),
      callback: this.observe("callback"),
      batch: this.observe("batch"),
    };

    const tap: Transport = {
      name: "page-tap",
      write: (entry) => {
        if (this.current !== undefined) {
          this.current.passed = true;
          this.current.entry = entry;
        }
      },
    };
    const logger = createLogger({
      level: LogLevel.INFO,
      context: "app",
      formatter,
      transports: [tap, this.observed.console, this.observed.memory],
      onTransportError: (error, transport) => {
        this.failures.unshift({ transport: transport.name, message: messageOf(error) });
        // A write that fails at once is in `emit`, and `emit` reports the change after it adds the record.
        if (this.current === undefined) this.changed();
      },
    });
    this.nodes.push({ id: this.nextId++, name: "app", context: "app", depth: 0, logger, attached: new Set(["console", "memory"]) });
  }

  /** The first logger of the tree. */
  get root(): LoggerNode {
    return this.nodes[0] as LoggerNode;
  }

  /** This method tells if a transport has the method `flush` or `close`. */
  has(transport: TransportId, method: "flush" | "close"): boolean {
    return typeof this.inner[transport][method] === "function";
  }

  /** This method calls the real log method of the logger, and gives the path of the record. */
  emit(node: LoggerNode, level: LogLevel, message: string, options: LogOptions = {}): Trace {
    const method = levelName(level);
    const trace: Trace = {
      id: ++this.sent,
      logger: options.context ?? node.context,
      call: `${identifier(node.name)}.${method}(${callArguments(message, options)})`,
      level,
      message,
      threshold: node.logger.getLevel(),
      formatter: this.formatterId,
      attached: [...node.attached],
      passed: false,
      deliveries: [],
    };
    this.current = trace;
    try {
      node.logger[method](message, options);
    } finally {
      this.current = undefined;
    }
    if (trace.passed) this.passed++;
    else this.dropped++;
    this.traces.unshift(trace);
    this.traces.length = Math.min(this.traces.length, TRACE_LIMIT);
    this.note(trace.call);
    this.changed();
    return trace;
  }

  /** This method calls `child()`, and adds the new logger after its parent and its other children. */
  addChild(parent: LoggerNode, name: string): LoggerNode {
    const logger = parent.logger.child(name);
    const node: LoggerNode = { id: this.nextId++, name, context: `${parent.context}:${name}`, depth: parent.depth + 1, logger, attached: new Set(parent.attached) };
    let at = this.nodes.indexOf(parent) + 1;
    while ((this.nodes[at]?.depth ?? -1) > parent.depth) at++;
    this.nodes.splice(at, 0, node);
    this.note(`const ${identifier(name)} = ${identifier(parent.name)}.child(${JSON.stringify(name)})`);
    this.changed();
    return node;
  }

  /** This method calls `setLevel()` on one logger. */
  setLevel(node: LoggerNode, level: LogLevel): void {
    node.logger.setLevel(level);
    this.note(`${identifier(node.name)}.setLevel(LogLevel.${LOG_LEVEL_NAMES[level]})`);
    this.changed();
  }

  /** This method selects the real formatter for the next records. */
  setFormatter(id: FormatterId): void {
    this.formatterId = id;
    this.real = FORMATTERS[id].make();
    this.note(`${FORMATTERS[id].factory}()`);
    this.changed();
  }

  /** This method calls `addTransport()` or `removeTransport()` on one logger. */
  setTransport(node: LoggerNode, id: TransportId, on: boolean): void {
    if (on === node.attached.has(id)) return;
    if (on) {
      node.logger.addTransport(this.observed[id]);
      node.attached.add(id);
      this.note(`${identifier(node.name)}.addTransport(${id})`);
    } else {
      node.logger.removeTransport(id);
      node.attached.delete(id);
      this.note(`${identifier(node.name)}.removeTransport(${JSON.stringify(id)})`);
    }
    this.changed();
  }

  /** This method calls `flush()` or `close()` on one logger, and gives what happened. */
  async finish(node: LoggerNode, action: "flush" | "close"): Promise<LifecycleResult> {
    const attached = [...node.attached];
    const held = this.batch.pending.length;
    this.busy = action;
    this.note(`await ${identifier(node.name)}.${action}()`);
    this.changed();
    const started = performance.now();
    let error: string | undefined;
    try {
      await node.logger[action]();
    } catch (cause) {
      error = messageOf(cause);
    }
    const result: LifecycleResult = {
      action,
      logger: node.context,
      with: attached.filter((id) => this.has(id, action)),
      without: attached.filter((id) => !this.has(id, action)),
      lines: attached.includes("batch") ? held - this.batch.pending.length : 0,
      ms: Math.round(performance.now() - started),
      error,
    };
    this.busy = undefined;
    this.lifecycle = result;
    this.changed();
    return result;
  }

  private note(code: string): void {
    this.calls.unshift(code);
    this.calls.length = Math.min(this.calls.length, 40);
  }

  private changed(): void {
    this.onChange();
  }

  private observe(id: TransportId): Transport {
    const inner = this.inner[id];
    return {
      name: id,
      write: (entry) => this.deliver(id, inner, entry),
      flush: () => inner.flush?.(),
      close: () => inner.close?.(),
    };
  }

  /** This method runs the real `write`, and writes down its result. It gives each failure back to the logger. */
  private deliver(id: TransportId, inner: Transport, entry: LogEntry): void | Promise<void> {
    const delivery: Delivery = { transport: id, state: "done" };
    this.current?.deliveries.push(delivery);
    this.formatted = undefined;
    try {
      const result = id === "console" ? this.writeConsole(delivery, inner, entry) : inner.write(entry);
      delivery.formatted = this.formatted;
      delivery.where ??= this.place(id);
      if (!isPromise(result)) return;
      delivery.state = "pending";
      return result.then(
        () => {
          delivery.state = "done";
          this.changed();
        },
        (error: unknown) => {
          delivery.state = "failed";
          delivery.error = messageOf(error);
          this.changed();
          throw error;
        },
      );
    } catch (error) {
      delivery.formatted = this.formatted;
      delivery.state = "failed";
      delivery.error = messageOf(error);
      throw error;
    }
  }

  private writeConsole(delivery: Delivery, inner: Transport, entry: LogEntry): void {
    const lines = captureConsole(() => void inner.write(entry), this.devtools);
    this.consoleLines.push(...lines);
    delivery.where = `console.${lines[0]?.method ?? "log"}`;
  }

  private place(id: TransportId): string {
    if (id === "memory") return `entries[${String(this.memory.entries.length - 1)}]`;
    if (id === "batch") return `pending[${String(this.batch.pending.length - 1)}]`;
    return "callback(entry, formatted)";
  }

  private onCallback(entry: LogEntry, formatted: string): void | Promise<void> {
    if (this.callbackMode === "throws") throw new Error("The callback threw this error.");
    if (this.callbackMode === "rejects") return Promise.reject(new Error("The callback rejected its promise."));
    const record = () => {
      this.callbackCalls.push({ entry, formatted });
    };
    if (this.callbackMode === "ok") {
      record();
      return;
    }
    return new Promise<void>((done) => setTimeout(done, this.times.slowCallbackMs)).then(() => {
      record();
      this.changed();
    });
  }
}

function callArguments(message: string, options: LogOptions): string {
  const parts = [
    options.context === undefined ? undefined : `context: ${JSON.stringify(options.context)}`,
    options.data === undefined ? undefined : `data: ${JSON.stringify(options.data)}`,
    options.error === undefined ? undefined : `error: new Error(${JSON.stringify(options.error.message)})`,
  ].filter((part) => part !== undefined);
  return parts.length === 0 ? JSON.stringify(message) : `${JSON.stringify(message)}, { ${parts.join(", ")} }`;
}
