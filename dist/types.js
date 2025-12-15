/**
 * Logger Types
 *
 * Core types for the logging system.
 */
// =============================================================================
// Log Levels
// =============================================================================
/**
 * Log level enumeration.
 * Lower values = more severe.
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 4] = "TRACE";
})(LogLevel || (LogLevel = {}));
/**
 * Log level names for display.
 */
export const LOG_LEVEL_NAMES = {
    [LogLevel.ERROR]: "ERROR",
    [LogLevel.WARN]: "WARN",
    [LogLevel.INFO]: "INFO",
    [LogLevel.DEBUG]: "DEBUG",
    [LogLevel.TRACE]: "TRACE",
};
/**
 * Parse a log level from string.
 */
export function parseLogLevel(level) {
    const upper = level.toUpperCase();
    const entry = Object.entries(LOG_LEVEL_NAMES).find(([, name]) => name === upper);
    return entry ? Number(entry[0]) : null;
}
//# sourceMappingURL=types.js.map