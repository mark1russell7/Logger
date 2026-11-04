/**
 * Log level enumeration.
 * Lower values = more severe.
 *
 * This file and `log-level.js` are one pair, because `erasableSyntaxOnly` refuses an enum in a `.ts` file. A published
 * `declare enum` keeps each member a constant for the caller, and a constant object does not.
 * The build copies both files to `dist`. The test `types.test.ts` holds the two files equal.
 */
export declare enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}
