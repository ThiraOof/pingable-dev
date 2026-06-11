import pino from 'pino';

// JSON logs in production (for log collectors); human-readable in dev.
const PROD = process.env.NODE_ENV === 'production';

const logger = pino(
  PROD
    ? { level: process.env.LOG_LEVEL || 'info' }
    : {
        level: process.env.LOG_LEVEL || 'debug',
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      },
);

export default logger;
