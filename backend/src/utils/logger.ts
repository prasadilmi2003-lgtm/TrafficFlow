import { pino, type Logger } from 'pino';
import { SERVICE_NAME, type AppConfig } from '../config/env.js';

export type { Logger };

/**
 * Creates the application logger.
 *
 * Pino writes one JSON object per line to standard output. Docker collects
 * these lines, and log tools can search and filter them by field. During
 * development, `npm run dev` pipes the output through pino-pretty to make it
 * readable.
 */
export function createLogger(config: Pick<AppConfig, 'logLevel' | 'appVersion'>): Logger {
  return pino({
    level: config.logLevel,
    // Fields added to every log line
    base: { service: SERVICE_NAME, version: config.appVersion },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Never write credentials to the logs (relevant once login exists)
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[REDACTED]',
    },
  });
}
