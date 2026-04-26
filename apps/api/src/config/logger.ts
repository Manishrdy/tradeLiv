import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const LOG_DIR = path.resolve(__dirname, '../../../../logs');

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${extras}`;
  }),
);

const rotateOptions = {
  dirname: LOG_DIR,
  maxSize: '10m',
  maxFiles: '14d',
  zippedArchive: true,
};

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    // All levels → combined log
    new DailyRotateFile({
      ...rotateOptions,
      filename: 'combined-%DATE%.log',
      format: fileFormat,
    }),
    // Error and above → separate error log
    new DailyRotateFile({
      ...rotateOptions,
      filename: 'error-%DATE%.log',
      level: 'error',
      format: fileFormat,
    }),
    new winston.transports.Console({ format: consoleFormat }),
  ],
});

export default logger;
