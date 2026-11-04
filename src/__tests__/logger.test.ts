import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Logger,
  createLogger,
  getDefaultLogger,
  setDefaultLogger,
  resetDefaultLogger,
} from "../logger.js";
import { LogLevel } from "../types.js";
import type { Transport, LogEntry, LoggerOptions } from "../types.js";
import { createCallbackTransport, createConsoleTransport } from "../transports.js";
import { JsonFormatter, SimpleFormatter } from "../formatters.js";

function createMockTransport(): Transport & { entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    name: "mock",
    entries,
    write(entry: LogEntry) {
      entries.push(entry);
    },
    flush: vi.fn(),
    close: vi.fn(),
  };
}

describe("Logger", () => {
  describe("log level filtering", () => {
    it("logs messages at or below the configured level", () => {
      const transport = createMockTransport();
      const logger = new Logger({
        level: LogLevel.INFO,
        transports: [transport],
      });

      logger.error("error message");
      logger.warn("warn message");
      logger.info("info message");

      expect(transport.entries).toHaveLength(3);
    });

    it("filters messages above the configured level", () => {
      const transport = createMockTransport();
      const logger = new Logger({
        level: LogLevel.WARN,
        transports: [transport],
      });

      logger.error("error message");
      logger.warn("warn message");
      logger.info("info message");
      logger.debug("debug message");

      expect(transport.entries).toHaveLength(2);
      expect(transport.entries[0]?.level).toBe(LogLevel.ERROR);
      expect(transport.entries[1]?.level).toBe(LogLevel.WARN);
    });

    it("can change log level at runtime", () => {
      const transport = createMockTransport();
      const logger = new Logger({
        level: LogLevel.ERROR,
        transports: [transport],
      });

      logger.info("should not log");
      expect(transport.entries).toHaveLength(0);

      logger.setLevel(LogLevel.INFO);
      logger.info("should log now");
      expect(transport.entries).toHaveLength(1);
    });
  });

  describe("log methods", () => {
    it("error() logs at ERROR level", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      logger.error("error message");

      expect(transport.entries[0]?.level).toBe(LogLevel.ERROR);
      expect(transport.entries[0]?.message).toBe("error message");
    });

    it("warn() logs at WARN level", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      logger.warn("warn message");

      expect(transport.entries[0]?.level).toBe(LogLevel.WARN);
    });

    it("info() logs at INFO level", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      logger.info("info message");

      expect(transport.entries[0]?.level).toBe(LogLevel.INFO);
    });

    it("debug() logs at DEBUG level", () => {
      const transport = createMockTransport();
      const logger = new Logger({ level: LogLevel.DEBUG, transports: [transport] });

      logger.debug("debug message");

      expect(transport.entries[0]?.level).toBe(LogLevel.DEBUG);
    });

    it("trace() logs at TRACE level", () => {
      const transport = createMockTransport();
      const logger = new Logger({ level: LogLevel.TRACE, transports: [transport] });

      logger.trace("trace message");

      expect(transport.entries[0]?.level).toBe(LogLevel.TRACE);
    });

    it("errorWithException() includes the error object", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });
      const error = new Error("test error");

      logger.errorWithException("error occurred", error);

      expect(transport.entries[0]?.error).toBe(error);
    });
  });

  describe("context", () => {
    it("includes default context in log entries", () => {
      const transport = createMockTransport();
      const logger = new Logger({
        context: "TestModule",
        transports: [transport],
      });

      logger.info("message");

      expect(transport.entries[0]?.context).toBe("TestModule");
    });

    it("allows per-log context override", () => {
      const transport = createMockTransport();
      const logger = new Logger({
        context: "DefaultContext",
        transports: [transport],
      });

      logger.info("message", { context: "OverrideContext" });

      expect(transport.entries[0]?.context).toBe("OverrideContext");
    });
  });

  describe("data and options", () => {
    it("includes data in log entry", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      logger.info("message", { data: { userId: 123, action: "login" } });

      expect(transport.entries[0]?.data).toEqual({ userId: 123, action: "login" });
    });

    it("includes timestamp in log entry", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      const before = new Date();
      logger.info("message");
      const after = new Date();

      expect(transport.entries[0]?.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(transport.entries[0]?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("child logger", () => {
    it("creates child with combined context", () => {
      const transport = createMockTransport();
      const parent = new Logger({
        context: "Parent",
        transports: [transport],
      });

      const child = parent.child("Child");
      child.info("message");

      expect(transport.entries[0]?.context).toBe("Parent:Child");
    });

    it("child inherits log level", () => {
      const transport = createMockTransport();
      const parent = new Logger({
        level: LogLevel.WARN,
        transports: [transport],
      });

      const child = parent.child("Child");
      child.info("should not log");
      child.warn("should log");

      expect(transport.entries).toHaveLength(1);
      expect(transport.entries[0]?.level).toBe(LogLevel.WARN);
    });

    it("child shares transports with parent", () => {
      const transport = createMockTransport();
      const parent = new Logger({ transports: [transport] });

      const child = parent.child("Child");
      parent.info("parent message");
      child.info("child message");

      expect(transport.entries).toHaveLength(2);
    });

    it("addTransport on a child does not mutate the parent's transports", () => {
      const parentTransport = createMockTransport();
      const parent = new Logger({ transports: [parentTransport] });
      const child = parent.child("Child");

      const childTransport = createMockTransport();
      child.addTransport(childTransport);

      parent.info("parent message");

      // The child-only transport must not receive the parent's writes.
      expect(childTransport.entries).toHaveLength(0);
      expect(parentTransport.entries).toHaveLength(1);

      child.info("child message");
      expect(childTransport.entries).toHaveLength(1);
    });

    it("handles child of logger without context", () => {
      const transport = createMockTransport();
      const parent = new Logger({ transports: [transport] });

      const child = parent.child("OnlyChild");
      child.info("message");

      expect(transport.entries[0]?.context).toBe("OnlyChild");
    });
  });

  describe("transport management", () => {
    it("writes to multiple transports", () => {
      const transport1 = createMockTransport();
      const transport2 = createMockTransport();
      const logger = new Logger({ transports: [transport1, transport2] });

      logger.info("message");

      expect(transport1.entries).toHaveLength(1);
      expect(transport2.entries).toHaveLength(1);
    });

    it("addTransport() adds a new transport", () => {
      const transport1 = createMockTransport();
      const transport2 = createMockTransport();
      const logger = new Logger({ transports: [transport1] });

      logger.info("before");
      logger.addTransport(transport2);
      logger.info("after");

      expect(transport1.entries).toHaveLength(2);
      expect(transport2.entries).toHaveLength(1);
    });

    it("removeTransport() removes transport by name", () => {
      const transport1 = createMockTransport();
      transport1.name = "first";
      const transport2 = createMockTransport();
      transport2.name = "second";
      const logger = new Logger({ transports: [transport1, transport2] });

      const removed = logger.removeTransport("first");
      logger.info("message");

      expect(removed).toBe(true);
      expect(transport1.entries).toHaveLength(0);
      expect(transport2.entries).toHaveLength(1);
    });

    it("removeTransport() returns false if not found", () => {
      const logger = new Logger({ transports: [] });
      const removed = logger.removeTransport("nonexistent");
      expect(removed).toBe(false);
    });
  });

  describe("flush and close", () => {
    it("flush() calls flush on all transports", async () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      await logger.flush();

      expect(transport.flush).toHaveBeenCalled();
    });

    it("close() calls close on all transports", async () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      await logger.close();

      expect(transport.close).toHaveBeenCalled();
    });

    it("flush() and close() wait for a promise of the transport", async () => {
      for (const method of ["flush", "close"] as const) {
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const logger = new Logger({
          transports: [{ name: "slow", write: () => {}, [method]: () => gate }],
        });

        let settled = false;
        const finished = logger[method]().then(() => {
          settled = true;
        });

        await Promise.resolve();
        await Promise.resolve();
        expect(settled).toBe(false);

        release();
        await finished;
        expect(settled).toBe(true);
      }
    });

    it("flush() and close() do not wait for a pending write", async () => {
      for (const method of ["flush", "close"] as const) {
        let release = () => {};
        let written = false;
        const logger = new Logger({
          transports: [
            createCallbackTransport({
              callback: async () => {
                await new Promise<void>((resolve) => {
                  release = resolve;
                });
                written = true;
              },
            }),
          ],
        });

        logger.info("hello");
        await logger[method]();

        // The promise of the logger is done, and the write still waits.
        expect(written).toBe(false);
        release();
      }
    });

    it("flush() rejects when a transport fails, and does not call onTransportError", async () => {
      const onTransportError = vi.fn();
      const logger = new Logger({
        transports: [
          {
            name: "broken",
            write: () => {},
            flush: () => Promise.reject(new Error("flush failed")),
          },
        ],
        onTransportError,
      });

      await expect(logger.flush()).rejects.toThrow("flush failed");
      expect(onTransportError).not.toHaveBeenCalled();
    });

    it("close() stops at a transport that throws synchronously", async () => {
      const later = vi.fn();
      const logger = new Logger({
        transports: [
          {
            name: "broken",
            write: () => {},
            close: () => {
              throw new Error("close failed");
            },
          },
          { name: "later", write: () => {}, close: later },
        ],
      });

      await expect(logger.close()).rejects.toThrow("close failed");
      expect(later).not.toHaveBeenCalled();
    });
  });

  describe("default formatter (LoggerOptions.formatter)", () => {
    it("applies LoggerOptions.formatter to transports without their own formatter", () => {
      let formatted = "";
      const cb = createCallbackTransport({
        callback: (_entry, f) => {
          formatted = f;
        },
      });
      const logger = new Logger({ transports: [cb], formatter: new JsonFormatter() });

      logger.info("hello");

      // The JSON formatter produces parseable JSON with the message field.
      const parsed = JSON.parse(formatted) as { message: string };
      expect(parsed.message).toBe("hello");
    });

    it("does not override a transport's own explicit formatter", () => {
      let formatted = "";
      const cb = createCallbackTransport({
        callback: (_entry, f) => {
          formatted = f;
        },
        formatter: new SimpleFormatter(),
      });
      const logger = new Logger({ transports: [cb], formatter: new JsonFormatter() });

      logger.info("hello");

      // SimpleFormatter output (not JSON) begins with the bracketed level.
      expect(formatted.startsWith("[INFO]")).toBe(true);
    });
  });

  describe("formatter on addTransport", () => {
    const pair = (options: LoggerOptions) => {
      const texts: { early?: string; late?: string } = {};
      const early = createCallbackTransport({
        callback: (_entry, f) => {
          texts.early = f;
        },
      });
      const late = createCallbackTransport({
        callback: (_entry, f) => {
          texts.late = f;
        },
      });
      const logger = new Logger({ transports: [early], formatter: new JsonFormatter(), ...options });
      return { texts, late, logger };
    };

    it("keeps the formatter of the transport by default", () => {
      const { texts, late, logger } = pair({});

      logger.addTransport(late);
      logger.info("hello");

      expect(texts.late).toBe("[INFO] hello");
      expect(texts.early?.startsWith("{")).toBe(true);
    });

    it("gives the logger formatter with formatAddedTransports", () => {
      const { texts, late, logger } = pair({ formatAddedTransports: true });

      logger.addTransport(late);
      logger.info("hello");

      expect(texts.late).toBe(texts.early);
    });

    it("copies formatAddedTransports to a child logger", () => {
      const { texts, late, logger } = pair({ formatAddedTransports: true });
      const child = logger.child("db");

      child.addTransport(late);
      child.info("hello");

      expect((JSON.parse(texts.late ?? "") as { context: string }).context).toBe("db");
    });

    it("keeps the own formatter of the transport with formatAddedTransports", () => {
      let text = "";
      const { logger } = pair({ formatAddedTransports: true });

      logger.addTransport(
        createCallbackTransport({
          callback: (_entry, f) => {
            text = f;
          },
          formatter: new SimpleFormatter(),
        }),
      );
      logger.info("hello");

      expect(text).toBe("[INFO] hello");
    });

    it("gives the logger formatter to a console transport with formatAddedTransports", () => {
      const info = vi.spyOn(console, "info").mockImplementation(() => {});
      const { logger } = pair({ formatAddedTransports: true });

      logger.addTransport(createConsoleTransport());
      logger.info("hello");

      expect(String(info.mock.calls[0]?.[0]).startsWith("{")).toBe(true);
      info.mockRestore();
    });

    it("accepts a transport without setDefaultFormatter with formatAddedTransports", () => {
      const transport = createMockTransport();
      const { logger } = pair({ formatAddedTransports: true });

      logger.addTransport(transport);
      logger.info("hello");

      expect(transport.entries).toHaveLength(1);
    });

    it("gives the logger formatter to an added transport at child(), also by default", () => {
      const { texts, late, logger } = pair({});

      logger.addTransport(late);
      logger.child("db");
      logger.info("hello");

      expect(texts.late).toBe(texts.early);
    });
  });

  describe("transport error handling", () => {
    it("does not reject when an async transport write rejects", async () => {
      const failing: Transport = {
        name: "failing",
        write: () => Promise.reject(new Error("write failed")),
      };
      const logger = new Logger({ transports: [failing] });

      // Must not throw synchronously and the rejection must be handled
      // internally (no unhandled rejection).
      expect(() => logger.info("boom")).not.toThrow();
      // Let the rejected microtask settle.
      await Promise.resolve();
      await Promise.resolve();
    });

    it("invokes onTransportError for a rejecting async transport", async () => {
      const err = new Error("async boom");
      const failing: Transport = {
        name: "failing",
        write: () => Promise.reject(err),
      };
      const onTransportError = vi.fn();
      const logger = new Logger({ transports: [failing], onTransportError });

      logger.info("boom");
      await Promise.resolve();
      await Promise.resolve();

      expect(onTransportError).toHaveBeenCalledWith(err, failing);
    });

    it("invokes onTransportError for a synchronously throwing transport and still writes to others", () => {
      const err = new Error("sync boom");
      const throwing: Transport = {
        name: "throwing",
        write: () => {
          throw err;
        },
      };
      const good = createMockTransport();
      const onTransportError = vi.fn();
      const logger = new Logger({ transports: [throwing, good], onTransportError });

      logger.info("boom");

      expect(onTransportError).toHaveBeenCalledWith(err, throwing);
      expect(good.entries).toHaveLength(1);
    });
  });
});

describe("createLogger", () => {
  it("creates a logger with options", () => {
    const logger = createLogger({ level: LogLevel.DEBUG });
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
  });

  it("creates a logger with default options", () => {
    const logger = createLogger();
    expect(logger.getLevel()).toBe(LogLevel.INFO);
  });
});

describe("default logger", () => {
  beforeEach(() => {
    resetDefaultLogger();
  });

  it("getDefaultLogger() creates a logger on first call", () => {
    const logger1 = getDefaultLogger();
    const logger2 = getDefaultLogger();
    expect(logger1).toBe(logger2);
  });

  it("setDefaultLogger() sets the default logger", () => {
    const customLogger = createLogger({ level: LogLevel.ERROR });
    setDefaultLogger(customLogger);

    expect(getDefaultLogger()).toBe(customLogger);
  });

  it("resetDefaultLogger() clears the default logger", () => {
    const logger1 = getDefaultLogger();
    resetDefaultLogger();
    const logger2 = getDefaultLogger();

    expect(logger1).not.toBe(logger2);
  });
});
