/**
 * The values of the log levels. The enum in `log-level.published.d.ts` is the one declaration of the members, and `tsc`
 * checks this object against it.
 */
import type { LogLevel as Declared } from "./log-level.published.js";

/** The object has the keys of a compiled enum: each name, and each number with its name. */
export const LogLevel: typeof Declared = {
  0: "ERROR",
  1: "WARN",
  2: "INFO",
  3: "DEBUG",
  4: "TRACE",
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

/** One log level. */
export type LogLevel = Declared;
