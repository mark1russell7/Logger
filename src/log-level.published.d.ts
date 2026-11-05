/**
 * Log level enumeration.
 * Lower values = more severe.
 *
 * The build copies this file to `dist/log-level.d.ts`, so the package publishes an enum, and a member stays a constant
 * for a caller. `erasableSyntaxOnly` refuses an enum in a `.ts` file, so `log-level.ts` holds the values.
 */
export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}
