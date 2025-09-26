import { env } from './env';

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

class ConsoleLogger implements Logger {
  private formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(this.formatMessage('info', message, meta));
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    const errorMeta = error ? { error: error.message, stack: error.stack } : {};
    console.error(this.formatMessage('error', message, { ...meta, ...errorMeta }));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage('warn', message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new ConsoleLogger();
