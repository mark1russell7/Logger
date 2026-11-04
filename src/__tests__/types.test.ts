import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { LogLevel, LOG_LEVEL_NAMES, parseLogLevel } from "../types.js";

describe("LogLevel", () => {
  it("has ERROR as lowest (most severe) value", () => {
    expect(LogLevel.ERROR).toBe(0);
  });

  it("has TRACE as highest (least severe) value", () => {
    expect(LogLevel.TRACE).toBe(4);
  });

  it("has correct ordering", () => {
    expect(LogLevel.ERROR).toBeLessThan(LogLevel.WARN);
    expect(LogLevel.WARN).toBeLessThan(LogLevel.INFO);
    expect(LogLevel.INFO).toBeLessThan(LogLevel.DEBUG);
    expect(LogLevel.DEBUG).toBeLessThan(LogLevel.TRACE);
  });

  it("keeps the number keys of a compiled enum", () => {
    expect(LogLevel[2]).toBe("INFO");
    expect(Object.keys(LogLevel)).toEqual(["0", "1", "2", "3", "4", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"]);
  });

  it("has each member of log-level.d.ts with the same value, because the two files are kept by hand", () => {
    const declaration = readFileSync(new URL("../log-level.d.ts", import.meta.url), "utf8");
    const members = [...declaration.matchAll(/^\s*([A-Z]+) = (\d+),$/gm)].map((m) => [m[1], Number(m[2])]);
    expect(members).toHaveLength(5);
    const names = Object.keys(LogLevel).filter((key) => Number.isNaN(Number(key)));
    expect(Object.fromEntries(members)).toEqual(Object.fromEntries(names.map((name) => [name, LogLevel[name as keyof typeof LogLevel]])));
  });
});

describe("LOG_LEVEL_NAMES", () => {
  it("maps all log levels to strings", () => {
    expect(LOG_LEVEL_NAMES[LogLevel.ERROR]).toBe("ERROR");
    expect(LOG_LEVEL_NAMES[LogLevel.WARN]).toBe("WARN");
    expect(LOG_LEVEL_NAMES[LogLevel.INFO]).toBe("INFO");
    expect(LOG_LEVEL_NAMES[LogLevel.DEBUG]).toBe("DEBUG");
    expect(LOG_LEVEL_NAMES[LogLevel.TRACE]).toBe("TRACE");
  });
});

describe("parseLogLevel", () => {
  it("parses uppercase level names", () => {
    expect(parseLogLevel("ERROR")).toBe(LogLevel.ERROR);
    expect(parseLogLevel("WARN")).toBe(LogLevel.WARN);
    expect(parseLogLevel("INFO")).toBe(LogLevel.INFO);
    expect(parseLogLevel("DEBUG")).toBe(LogLevel.DEBUG);
    expect(parseLogLevel("TRACE")).toBe(LogLevel.TRACE);
  });

  it("parses lowercase level names", () => {
    expect(parseLogLevel("error")).toBe(LogLevel.ERROR);
    expect(parseLogLevel("warn")).toBe(LogLevel.WARN);
    expect(parseLogLevel("info")).toBe(LogLevel.INFO);
    expect(parseLogLevel("debug")).toBe(LogLevel.DEBUG);
    expect(parseLogLevel("trace")).toBe(LogLevel.TRACE);
  });

  it("parses mixed case level names", () => {
    expect(parseLogLevel("Error")).toBe(LogLevel.ERROR);
    expect(parseLogLevel("Info")).toBe(LogLevel.INFO);
  });

  it("returns null for invalid level names", () => {
    expect(parseLogLevel("invalid")).toBe(null);
    expect(parseLogLevel("")).toBe(null);
    expect(parseLogLevel("WARNING")).toBe(null);
  });
});
