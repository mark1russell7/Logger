import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Logger,
  createLogger,
  getDefaultLogger,
  setDefaultLogger,
  resetDefaultLogger,
} from "../logger.js";
import { LogLevel } from "../types.js";
import type { Transport, LogEntry } from "../types.js";

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
      expect(transport.entries[0].level).toBe(LogLevel.ERROR);
      expect(transport.entries[1].level).toBe(LogLevel.WARN);
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

      expect(transport.entries[0].level).toBe(LogLevel.ERROR);
      expect(transport.entries[0].message).toBe("error message");
    });

    it("warn() logs at WARN level", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      logger.warn("warn message");

      expect(transport.entries[0].level).toBe(LogLevel.WARN);
    });

    it("info() logs at INFO level", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      logger.info("info message");

      expect(transport.entries[0].level).toBe(LogLevel.INFO);
    });

    it("debug() logs at DEBUG level", () => {
      const transport = createMockTransport();
      const logger = new Logger({ level: LogLevel.DEBUG, transports: [transport] });

      logger.debug("debug message");

      expect(transport.entries[0].level).toBe(LogLevel.DEBUG);
    });

    it("trace() logs at TRACE level", () => {
      const transport = createMockTransport();
      const logger = new Logger({ level: LogLevel.TRACE, transports: [transport] });

      logger.trace("trace message");

      expect(transport.entries[0].level).toBe(LogLevel.TRACE);
    });

    it("errorWithException() includes the error object", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });
      const error = new Error("test error");

      logger.errorWithException("error occurred", error);

      expect(transport.entries[0].error).toBe(error);
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

      expect(transport.entries[0].context).toBe("TestModule");
    });

    it("allows per-log context override", () => {
      const transport = createMockTransport();
      const logger = new Logger({
        context: "DefaultContext",
        transports: [transport],
      });

      logger.info("message", { context: "OverrideContext" });

      expect(transport.entries[0].context).toBe("OverrideContext");
    });
  });

  describe("data and options", () => {
    it("includes data in log entry", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      logger.info("message", { data: { userId: 123, action: "login" } });

      expect(transport.entries[0].data).toEqual({ userId: 123, action: "login" });
    });

    it("includes timestamp in log entry", () => {
      const transport = createMockTransport();
      const logger = new Logger({ transports: [transport] });

      const before = new Date();
      logger.info("message");
      const after = new Date();

      expect(transport.entries[0].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(transport.entries[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
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

      expect(transport.entries[0].context).toBe("Parent:Child");
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
      expect(transport.entries[0].level).toBe(LogLevel.WARN);
    });

    it("child shares transports with parent", () => {
      const transport = createMockTransport();
      const parent = new Logger({ transports: [transport] });

      const child = parent.child("Child");
      parent.info("parent message");
      child.info("child message");

      expect(transport.entries).toHaveLength(2);
    });

    it("handles child of logger without context", () => {
      const transport = createMockTransport();
      const parent = new Logger({ transports: [transport] });

      const child = parent.child("OnlyChild");
      child.info("message");

      expect(transport.entries[0].context).toBe("OnlyChild");
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
