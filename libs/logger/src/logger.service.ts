import { Injectable, Optional, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { cyan, blue, yellow, green, magenta, red, gray, bold } from 'colorette';
import { CorrelationContext } from './correlation-id.context';

const serviceColors: Record<string, (text: string) => string> = {
  'API-GATEWAY': cyan,
  'USER-SERVICE': blue,
  'MARKETPLACE-SERVICE': yellow,
  'FINANCIAL-SERVICE': green,
  'COMMUNICATION-SERVICE': magenta,
};

function formatServiceName(serviceName: string): string {
  const colorFn = serviceColors[serviceName.toUpperCase()] || gray;
  return bold(colorFn(`[${serviceName.toUpperCase()}]`));
}

@Injectable()
export class AppLoggerService implements NestLoggerService {
  private winstonLogger: winston.Logger;
  private serviceName: string;

  constructor(@Optional() serviceName?: string) {
    this.serviceName = serviceName || 'USER-SERVICE';
    this.winstonLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [new winston.transports.Console()],
    });
  }

  setServiceName(name: string) {
    this.serviceName = name;
  }

  private print(level: string, message: any, context?: string, trace?: string) {
    const timestamp = new Date().toISOString();
    const correlationId = CorrelationContext.getCorrelationId() || 'N/A';
    const tag = formatServiceName(this.serviceName);

    const logObject = {
      timestamp,
      service: this.serviceName,
      level,
      context,
      correlationId,
      message,
      trace,
    };

    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logObject));
    } else {
      const levelStr = level === 'error' ? red(level.toUpperCase()) : level.toUpperCase();
      console.log(
        `${gray(timestamp)} ${tag} [${levelStr}] [Context: ${context || 'App'}] [CorrID: ${correlationId}]: ${typeof message === 'object' ? JSON.stringify(message) : message}${trace ? `\n${red(trace)}` : ''}`,
      );
    }
  }

  log(message: any, context?: string) {
    this.print('info', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.print('error', message, context, trace);
  }

  warn(message: any, context?: string) {
    this.print('warn', message, context);
  }

  debug(message: any, context?: string) {
    this.print('debug', message, context);
  }
}
