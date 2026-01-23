import { appConfig } from "./config/app.config";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
  method?: string;
  path?: string;
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: any;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;
  private format: "json" | "text";

  constructor() {
    this.level = appConfig.logging.level;
    this.format = appConfig.logging.format;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();

    if (this.format === "json") {
      return JSON.stringify({ timestamp, level, message, ...context });
    }

    const contextStr = context
      ? ` ${Object.entries(context)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(" ")}`
      : "";

    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, context));
    }
  }

  error(message: string, context?: LogContext, error?: unknown): void {
    if (this.shouldLog("error")) {
      const errorContext: LogContext = { ...context };
      if (error instanceof Error) {
        errorContext.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else if (error) {
        errorContext.error = error;
      }
      console.error(this.formatMessage("error", message, errorContext));
    }
  }
}

export const logger = new Logger();
