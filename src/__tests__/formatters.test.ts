import { describe, it, expect } from "vitest";
import { SimpleFormatter, TimestampedFormatter, JsonFormatter } from "../formatters.js";
import { LogLevel } from "../types.js";
import type { LogEntry } from "../types.js";

const baseEntry: LogEntry = {
  level: LogLevel.INFO,
  message: "Test message",
  timestamp: new Date("2024-01-15T10:30:00.000Z"),
};

describe("SimpleFormatter", () => {
  const formatter = new SimpleFormatter();

  it("formats basic log entry", () => {
    const result = formatter.format(baseEntry);
    expect(result).toBe("[INFO] Test message");
  });

  it("includes context when present", () => {
    const entry: LogEntry = { ...baseEntry, context: "TestModule" };
    const result = formatter.format(entry);
    expect(result).toBe("[INFO] [TestModule] Test message");
  });

  it("includes data as JSON when present", () => {
    const entry: LogEntry = { ...baseEntry, data: { userId: 123 } };
    const result = formatter.format(entry);
    expect(result).toBe('[INFO] Test message {"userId":123}');
  });

  it("excludes empty data object", () => {
    const entry: LogEntry = { ...baseEntry, data: {} };
    const result = formatter.format(entry);
    expect(result).toBe("[INFO] Test message");
  });

  it("includes error stack when present", () => {
    const error = new Error("Something went wrong");
    const entry: LogEntry = { ...baseEntry, level: LogLevel.ERROR, error };
    const result = formatter.format(entry);
    expect(result).toContain("[ERROR] Test message");
    expect(result).toContain("Something went wrong");
  });

  it("formats all log levels correctly", () => {
    expect(formatter.format({ ...baseEntry, level: LogLevel.ERROR })).toContain("[ERROR]");
    expect(formatter.format({ ...baseEntry, level: LogLevel.WARN })).toContain("[WARN]");
    expect(formatter.format({ ...baseEntry, level: LogLevel.INFO })).toContain("[INFO]");
    expect(formatter.format({ ...baseEntry, level: LogLevel.DEBUG })).toContain("[DEBUG]");
    expect(formatter.format({ ...baseEntry, level: LogLevel.TRACE })).toContain("[TRACE]");
  });
});

describe("TimestampedFormatter", () => {
  const formatter = new TimestampedFormatter();

  it("includes ISO timestamp", () => {
    const result = formatter.format(baseEntry);
    expect(result).toBe("[2024-01-15T10:30:00.000Z] [INFO] Test message");
  });

  it("includes context when present", () => {
    const entry: LogEntry = { ...baseEntry, context: "TestModule" };
    const result = formatter.format(entry);
    expect(result).toBe("[2024-01-15T10:30:00.000Z] [INFO] [TestModule] Test message");
  });

  it("includes data as JSON when present", () => {
    const entry: LogEntry = { ...baseEntry, data: { key: "value" } };
    const result = formatter.format(entry);
    expect(result).toContain('{"key":"value"}');
  });
});

describe("JsonFormatter", () => {
  const formatter = new JsonFormatter();

  it("outputs valid JSON", () => {
    const result = formatter.format(baseEntry);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("includes required fields", () => {
    const result = JSON.parse(formatter.format(baseEntry));
    expect(result.level).toBe("INFO");
    expect(result.message).toBe("Test message");
    expect(result.timestamp).toBe("2024-01-15T10:30:00.000Z");
  });

  it("includes context when present", () => {
    const entry: LogEntry = { ...baseEntry, context: "TestModule" };
    const result = JSON.parse(formatter.format(entry));
    expect(result.context).toBe("TestModule");
  });

  it("omits context when not present", () => {
    const result = JSON.parse(formatter.format(baseEntry));
    expect(result.context).toBeUndefined();
  });

  it("includes data when present", () => {
    const entry: LogEntry = { ...baseEntry, data: { userId: 123, active: true } };
    const result = JSON.parse(formatter.format(entry));
    expect(result.data).toEqual({ userId: 123, active: true });
  });

  it("includes error details when present", () => {
    const error = new Error("Test error");
    error.name = "TestError";
    const entry: LogEntry = { ...baseEntry, error };
    const result = JSON.parse(formatter.format(entry));
    expect(result.error.name).toBe("TestError");
    expect(result.error.message).toBe("Test error");
    expect(result.error.stack).toBeDefined();
  });
});
